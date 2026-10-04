import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { generateKeyPairSync, sign } from 'node:crypto';
vi.mock('server-only', () => ({}));
const { auth, cookieGet } = vi.hoisted(() => ({ auth: vi.fn(), cookieGet: vi.fn() }));
vi.mock('../src/domains/access/authorize', () => ({ authorizedPerson: auth }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: cookieGet }) }));
import {
  customerConfig,
  prepareCustomerConnection,
  openCustomer,
  sealCustomer,
  validateCustomerFlow,
  completeCustomerConnection,
  customerSession,
  readCustomerOrders,
  discoverCustomer,
  ACCOUNT_COOKIE,
  FLOW_COOKIE,
} from '../src/domains/commerce/customer-account';
import { customerOrdersWorkspace } from '../src/domains/commerce/customer-workspace';
import { POST, DELETE } from '../src/app/api/commerce/customer/route';
import { GET as callback } from '../src/app/api/commerce/customer/callback/route';
import { POST as disconnect } from '../src/app/api/commerce/customer/disconnect/route';
import { NextRequest } from 'next/server';
const person = 'ce000000-0000-4000-8000-000000000001',
  other = 'ce000000-0000-4000-8000-000000000002';
const env = {
  SHOPIFY_CUSTOMER_ACCOUNT_ENABLED: 'true',
  SHOPIFY_CUSTOMER_CLIENT_ID: 'customer-client-123',
  SHOPIFY_CUSTOMER_SESSION_KEY: 'ab'.repeat(32),
  SHOPIFY_STORE_DOMAIN: 'gent.myshopify.com',
  NEXT_PUBLIC_APP_URL: 'https://www.gentascend.com',
};
const config = customerConfig(env)!;
const issuer = 'https://shopify.com/authentication/123';
const discovery = {
  issuer,
  authorization_endpoint: issuer + '/oauth/authorize',
  token_endpoint: issuer + '/oauth/token',
  jwks_uri: issuer + '/.well-known/jwks.json',
};
const api = { graphql_api: 'https://shopify.com/123/account/customer/api/2026-10/graphql' };
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = {
  ...publicKey.export({ format: 'jwk' }),
  kid: 'synthetic-key',
  alg: 'RS256',
  use: 'sig',
};
function token(nonce: string, overrides: Record<string, unknown> = {}) {
  const h = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'synthetic-key' })).toString(
    'base64url',
  );
  const c = Buffer.from(
    JSON.stringify({
      iss: issuer,
      aud: config.client,
      sub: 'customer-1',
      nonce,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 1800,
      ...overrides,
    }),
  ).toString('base64url');
  return `${h}.${c}.${sign('sha256', Buffer.from(`${h}.${c}`), privateKey).toString('base64url')}`;
}
let nonce = '',
  claimOverrides: Record<string, unknown> = {},
  badSignature = false,
  identity = 'gid://shopify/Customer/1',
  orderCustomer = identity,
  providerError = false,
  evilEndpoint = false;
let tokenOverride = '',
  keyOverride: Record<string, unknown>[] = [];
let requests: { url: string; options: RequestInit }[] = [];
const order = {
  id: 'gid://shopify/Order/1',
  name: '#1001',
  processedAt: '2026-10-04T12:00:00Z',
  cancelledAt: null,
  financialStatus: 'PAID',
  fulfillmentStatus: 'UNFULFILLED',
  totalPrice: { amount: '48.00', currencyCode: 'USD' },
};
beforeEach(() => {
  vi.stubEnv('SHOPIFY_CUSTOMER_ACCOUNT_ENABLED', 'true');
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  auth.mockResolvedValue({ person: { id: person }, client: {} });
  cookieGet.mockReturnValue(undefined);
  requests = [];
  nonce = '';
  claimOverrides = {};
  badSignature = false;
  identity = 'gid://shopify/Customer/1';
  orderCustomer = identity;
  providerError = false;
  evilEndpoint = false;
  tokenOverride = '';
  keyOverride = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, options: RequestInit) => {
      const url = String(input);
      requests.push({ url, options });
      if (url.endsWith('openid-configuration'))
        return Response.json(
          evilEndpoint ? { ...discovery, token_endpoint: 'https://evil.example/token' } : discovery,
        );
      if (url.endsWith('customer-account-api')) return Response.json(api);
      if (url.endsWith('jwks.json'))
        return Response.json({ keys: keyOverride.length ? keyOverride : [jwk] });
      if (url.endsWith('/oauth/token'))
        return Response.json({
          access_token: 'synthetic-private-access',
          expires_in: 7200,
          id_token:
            tokenOverride ||
            (badSignature ? token(nonce).slice(0, -8) + 'xxxxxxxx' : token(nonce, claimOverrides)),
        });
      const q = JSON.parse(String(options.body)).query as string;
      if (providerError)
        return Response.json({ errors: [{ message: 'private-provider-error' }], data: null });
      return Response.json(
        q.includes('GentCustomerIdentity')
          ? { data: { customer: { id: identity, displayName: 'Synthetic customer' } } }
          : {
              data: {
                customer: {
                  id: orderCustomer,
                  orders: { nodes: [order], pageInfo: { hasNextPage: true } },
                },
              },
            },
      );
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
async function prepared() {
  const p = await prepareCustomerConnection(person, config);
  const flow = openCustomer(p.cookie, 'flow', config) as {
    nonce: string;
    state: string;
    verifier: string;
    expires: number;
  };
  nonce = flow.nonce;
  return { ...p, flow };
}
describe('Shopify customer connection boundary', () => {
  it('is closed without complete merchant configuration and a canonical HTTPS origin', () => {
    expect(customerConfig({})).toBeNull();
    expect(customerConfig({ ...env, SHOPIFY_CUSTOMER_SESSION_KEY: 'weak' })).toBeNull();
    expect(customerConfig({ ...env, NEXT_PUBLIC_APP_URL: 'http://localhost:3000' })).toBeNull();
    expect(
      customerConfig({ ...env, NEXT_PUBLIC_APP_URL: 'https://www.gentascend.com/elsewhere' }),
    ).toBeNull();
  });
  it('discovers endpoints and emits random owner-bound state, nonce and S256 PKCE without email hints', async () => {
    const a = await prepared(),
      b = await prepared(),
      url = new URL(a.location);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).not.toBe(a.flow.verifier);
    expect(url.searchParams.get('login_hint')).toBeNull();
    expect(a.flow.state).not.toBe(b.flow.state);
    expect(a.cookie).not.toContain(a.flow.verifier);
    expect(validateCustomerFlow(a.cookie, a.flow.state, person, config).person).toBe(person);
    expect(
      requests.every((r) => r.options.cache === 'no-store' && r.options.redirect === 'error'),
    ).toBe(true);
  });
  it('rejects endpoint substitution before sending a code or credential', async () => {
    evilEndpoint = true;
    await expect(discoverCustomer(config)).rejects.toThrow();
    expect(requests.every((r) => !r.url.includes('evil.example'))).toBe(true);
  });
  it('rejects tampering, expired flow, changed account, purpose and configuration', async () => {
    const p = await prepared();
    for (const [raw, state, who] of [
      [p.cookie, p.flow.state, other],
      [p.cookie, 'wrong', person],
      [p.cookie.slice(0, -10) + 'changed', p.flow.state, person],
      [sealCustomer({ ...p.flow, person, expires: 1 }, 'flow', config), p.flow.state, person],
    ] as const)
      expect(() => validateCustomerFlow(raw, state, who, config)).toThrow();
    expect(openCustomer(p.cookie, 'account', config)).toBeNull();
    expect(openCustomer(p.cookie, 'flow', { ...config, client: 'different-client' })).toBeNull();
  });
  it('verifies signed identity and API customer then seals a short private session; refresh tokens are not stored', async () => {
    const p = await prepared(),
      result = await completeCustomerConnection(
        person,
        p.cookie,
        p.flow.state,
        'one-time-code',
        config,
      );
    expect(result.seconds).toBe(3600);
    expect(result.cookie).not.toContain('synthetic-private-access');
    const session = customerSession(result.cookie, person, config)!;
    expect(session.customer).toBe(identity);
    expect(customerSession(result.cookie, other, config)).toBeNull();
    const exchange = requests.find((r) => r.url === discovery.token_endpoint)!;
    expect(new URLSearchParams(String(exchange.options.body)).get('code_verifier')).toBe(
      p.flow.verifier,
    );
    expect(new URLSearchParams(String(exchange.options.body)).get('redirect_uri')).toBe(
      config.redirect,
    );
    expect(JSON.stringify(openCustomer(result.cookie, 'account', config))).not.toContain('refresh');
  });
  it.each([
    { nonce: 'wrong' },
    { aud: 'other-client' },
    { iss: 'https://shopify.com/authentication/999' },
    { exp: 1 },
    { iat: Math.floor(Date.now() / 1000) + 300 },
    { aud: [config.client, 'other'], azp: 'other' },
    { aud: [config.client, 'other'], azp: config.client },
  ])('rejects signed but invalid OpenID claims %j', async (overrides) => {
    const p = await prepared();
    claimOverrides = overrides;
    await expect(
      completeCustomerConnection(person, p.cookie, p.flow.state, 'code', config),
    ).rejects.toThrow();
    expect(requests.filter((r) => r.url === api.graphql_api)).toHaveLength(0);
  });
  it('verifies ES256 using a matching P-256 signing key', async () => {
    const p = await prepared();
    const keys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    keyOverride = [
      {
        ...keys.publicKey.export({ format: 'jwk' }),
        kid: 'ec-key',
        alg: 'ES256',
        use: 'sig',
        key_ops: ['verify'],
      },
    ];
    const head = Buffer.from(JSON.stringify({ alg: 'ES256', kid: 'ec-key' })).toString('base64url');
    const claims = Buffer.from(
      JSON.stringify({
        iss: issuer,
        aud: config.client,
        sub: 'customer-1',
        nonce: p.flow.nonce,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 300,
      }),
    ).toString('base64url');
    tokenOverride = `${head}.${claims}.${sign('sha256', Buffer.from(`${head}.${claims}`), { key: keys.privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
    const result = await completeCustomerConnection(person, p.cookie, p.flow.state, 'code', config);
    expect(customerSession(result.cookie, person, config)?.customer).toBe(identity);
  });
  it('rejects an invalid signature and customer API errors', async () => {
    const p = await prepared();
    badSignature = true;
    await expect(
      completeCustomerConnection(person, p.cookie, p.flow.state, 'code', config),
    ).rejects.toThrow();
    badSignature = false;
    providerError = true;
    await expect(
      completeCustomerConnection(person, p.cookie, p.flow.state, 'code', config),
    ).rejects.toThrow();
  });
  it('returns bounded order metadata with distinct payment/fulfillment and no credentials', async () => {
    const p = await prepared(),
      result = await completeCustomerConnection(person, p.cookie, p.flow.state, 'code', config);
    const view = await readCustomerOrders(customerSession(result.cookie, person, config)!, config);
    expect(view.orders).toEqual([order]);
    expect(view.more).toBe(true);
    expect(JSON.stringify(view)).not.toContain('synthetic-private-access');
    const req = requests.at(-1)!;
    expect(req.options.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'synthetic-private-access',
    });
    expect(String(req.options.body)).toContain('orders(first: 10');
    expect(String(req.options.body)).not.toMatch(/shippingAddress|lineItems|emailAddress/);
    orderCustomer = 'gid://shopify/Customer/2';
    await expect(
      readCustomerOrders(customerSession(result.cookie, person, config)!, config),
    ).rejects.toThrow();
  });
  it('reads nothing for signed-out, unconfigured, foreign or expired sessions and keeps failures distinct from empty orders', async () => {
    auth.mockResolvedValue(null);
    expect(await customerOrdersWorkspace()).toEqual({ state: 'signed-out' });
    expect(requests).toHaveLength(0);
    auth.mockResolvedValue({ person: { id: person } });
    vi.stubEnv('SHOPIFY_CUSTOMER_ACCOUNT_ENABLED', 'false');
    expect(await customerOrdersWorkspace()).toEqual({ state: 'unconfigured' });
    vi.stubEnv('SHOPIFY_CUSTOMER_ACCOUNT_ENABLED', 'true');
    cookieGet.mockReturnValue({
      value: sealCustomer(
        {
          person: other,
          customer: identity,
          displayName: 'Other',
          access: 'private',
          expires: Math.floor(Date.now() / 1000) + 100,
        },
        'account',
        config,
      ),
    });
    expect(await customerOrdersWorkspace()).toEqual({ state: 'disconnected' });
    cookieGet.mockReturnValue({
      value: sealCustomer(
        { person, customer: identity, displayName: 'Synthetic', access: 'private', expires: 1 },
        'account',
        config,
      ),
    });
    expect(await customerOrdersWorkspace()).toEqual({ state: 'disconnected' });
    expect(requests).toHaveLength(0);
    cookieGet.mockReturnValue({
      value: sealCustomer(
        {
          person,
          customer: identity,
          displayName: 'Synthetic',
          access: 'private',
          expires: Math.floor(Date.now() / 1000) + 100,
        },
        'account',
        config,
      ),
    });
    providerError = true;
    expect(await customerOrdersWorkspace()).toEqual({ state: 'unavailable' });
  });
  it('protects connection and disconnect POSTs with real owner resolution and same origin', async () => {
    const hostile = new NextRequest(config.origin + '/api/commerce/customer', {
      method: 'POST',
      headers: { origin: 'https://evil.example' },
    });
    expect((await POST(hostile)).status).toBe(403);
    expect(auth).not.toHaveBeenCalled();
    const own = new NextRequest(config.origin + '/api/commerce/customer', {
      method: 'POST',
      headers: { origin: config.origin },
    });
    auth.mockResolvedValue(null);
    expect((await POST(own)).headers.get('location')).toBe(config.origin + '/enter');
    expect(requests).toHaveLength(0);
    auth.mockResolvedValue({ person: { id: person } });
    const response = await POST(own);
    const flow = response.cookies.get(FLOW_COOKIE)!;
    expect(flow.httpOnly).toBe(true);
    expect(flow.secure).toBe(true);
    expect(flow.sameSite).toBe('lax');
    expect(flow.maxAge).toBe(600);
    expect(response.cookies.get(ACCOUNT_COOKIE)?.maxAge).toBe(0);
    const disc = await disconnect(
      new NextRequest(config.origin + '/api/commerce/customer/disconnect', {
        method: 'POST',
        headers: { origin: config.origin },
      }),
    );
    expect(disc.cookies.get(ACCOUNT_COOKIE)?.maxAge).toBe(0);
    expect(disc.cookies.get(FLOW_COOKIE)?.maxAge).toBe(0);
    expect((await DELETE(hostile)).status).toBe(403);
  });
  it('clears callback state on rejection, strips codes from redirects and never trusts an email or customer id parameter', async () => {
    const p = await prepared();
    cookieGet.mockReturnValue({ value: p.cookie });
    const wrong = await callback(
      new NextRequest(config.redirect + '?state=wrong&code=secret&customerId=1'),
    );
    expect(wrong.cookies.get(FLOW_COOKIE)?.maxAge).toBe(0);
    expect(wrong.cookies.get(ACCOUNT_COOKIE)?.maxAge).toBe(0);
    expect(wrong.headers.get('location')).not.toContain('secret');
    expect(requests.filter((r) => r.url === discovery.token_endpoint)).toHaveLength(0);
    const ok = await callback(
      new NextRequest(config.redirect + `?state=${p.flow.state}&code=secret`),
    );
    expect(ok.cookies.get(ACCOUNT_COOKIE)?.maxAge).toBe(3600);
    expect(ok.headers.get('referrer-policy')).toBe('no-referrer');
    expect(customerSession(ok.cookies.get(ACCOUNT_COOKIE)?.value, person, config)?.customer).toBe(
      identity,
    );
  });
});
