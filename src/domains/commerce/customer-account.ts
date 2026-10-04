import 'server-only';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createPublicKey,
  randomBytes,
  verify,
} from 'node:crypto';
import { z } from 'zod';

export class CustomerAccountError extends Error {}
export const CUSTOMER_PATH = '/app/collection/orders';
export const FLOW_COOKIE = '__Host-gent-customer-flow';
export const ACCOUNT_COOKIE = '__Host-gent-customer-account';
const text = z.string().min(1).max(200);
const endpoint = z.url().max(1000);
const configSchema = z.object({
  domain: z.string().regex(/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/),
  client: z.string().regex(/^[a-zA-Z0-9_-]{10,200}$/),
  key: z.string().regex(/^[a-f0-9]{64}$/i),
  origin: endpoint,
  accountHost: z
    .string()
    .regex(/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/)
    .optional(),
});
export function customerConfig(env: Record<string, string | undefined> = process.env) {
  if (env.SHOPIFY_CUSTOMER_ACCOUNT_ENABLED !== 'true') return null;
  const parsed = configSchema.safeParse({
    domain: env.SHOPIFY_STORE_DOMAIN,
    client: env.SHOPIFY_CUSTOMER_CLIENT_ID,
    key: env.SHOPIFY_CUSTOMER_SESSION_KEY,
    origin: env.NEXT_PUBLIC_APP_URL,
    accountHost: env.SHOPIFY_CUSTOMER_ACCOUNT_HOST,
  });
  if (!parsed.success) return null;
  const url = new URL(parsed.data.origin);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    return null;
  return {
    ...parsed.data,
    origin: url.origin,
    redirect: `${url.origin}/api/commerce/customer/callback`,
  };
}
type Config = NonNullable<ReturnType<typeof customerConfig>>;
const binding = (config: Config) =>
  createHash('sha256').update(`${config.domain}|${config.client}|${config.origin}`).digest('hex');
function trustedUrl(raw: string, config: Config) {
  const url = new URL(raw);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    url.hash ||
    ![config.domain, 'shopify.com', config.accountHost].includes(url.hostname)
  )
    throw new CustomerAccountError('Account connection is temporarily unavailable.');
  return url.toString();
}
async function json(url: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new CustomerAccountError(
      'Shopify could not confirm this connection. Please connect again.',
    );
  // Bound discovery, key and private API payloads; no raw provider errors escape.
  const body = await response.text();
  if (body.length > 250000)
    throw new CustomerAccountError('The account response could not be read.');
  return JSON.parse(body) as unknown;
}
const discoverySchema = z.object({
  issuer: endpoint,
  authorization_endpoint: endpoint,
  token_endpoint: endpoint,
  jwks_uri: endpoint,
});
export async function discoverCustomer(config: Config) {
  const [auth, api] = await Promise.all([
    json(`https://${config.domain}/.well-known/openid-configuration`),
    json(`https://${config.domain}/.well-known/customer-account-api`),
  ]);
  const d = discoverySchema.parse(auth),
    a = z.object({ graphql_api: endpoint }).parse(api);
  if (!/^https:\/\/shopify\.com\/authentication\/[0-9]+$/.test(d.issuer))
    throw new CustomerAccountError('Account connection is temporarily unavailable.');
  return {
    issuer: d.issuer,
    authorize: trustedUrl(d.authorization_endpoint, config),
    token: trustedUrl(d.token_endpoint, config),
    jwks: trustedUrl(d.jwks_uri, config),
    graphql: trustedUrl(a.graphql_api, config),
  };
}
type Discovery = Awaited<ReturnType<typeof discoverCustomer>>;
export function sealCustomer(value: unknown, purpose: 'flow' | 'account', config: Config) {
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', Buffer.from(config.key, 'hex'), iv);
  cipher.setAAD(Buffer.from(`gent-customer-v1|${purpose}|${binding(config)}`));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  const result = Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
  if (result.length > 3800)
    throw new CustomerAccountError('The account session is too large. Please try again.');
  return result;
}
export function openCustomer(
  raw: string | undefined,
  purpose: 'flow' | 'account',
  config: Config,
): unknown {
  try {
    if (!raw || raw.length > 3800 || !/^[A-Za-z0-9_-]+$/.test(raw)) return null;
    const bytes = Buffer.from(raw, 'base64url');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      Buffer.from(config.key, 'hex'),
      bytes.subarray(0, 12),
    );
    decipher.setAAD(Buffer.from(`gent-customer-v1|${purpose}|${binding(config)}`));
    decipher.setAuthTag(bytes.subarray(12, 28));
    return JSON.parse(
      Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8'),
    ) as unknown;
  } catch {
    return null;
  }
}
const flowSchema = z.object({
  person: z.uuid(),
  state: text,
  verifier: text,
  nonce: text,
  expires: z.number().int(),
});
export async function prepareCustomerConnection(person: string, config: Config) {
  const d = await discoverCustomer(config),
    flow = {
      person,
      state: randomBytes(32).toString('base64url'),
      verifier: randomBytes(32).toString('base64url'),
      nonce: randomBytes(32).toString('base64url'),
      expires: Math.floor(Date.now() / 1000) + 600,
    };
  const url = new URL(d.authorize);
  for (const [key, value] of Object.entries({
    client_id: config.client,
    response_type: 'code',
    scope: 'openid email customer-account-api:full',
    redirect_uri: config.redirect,
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: createHash('sha256').update(flow.verifier).digest('base64url'),
    code_challenge_method: 'S256',
  }))
    url.searchParams.set(key, value);
  return { location: url.toString(), cookie: sealCustomer(flow, 'flow', config) };
}
export function validateCustomerFlow(
  raw: string | undefined,
  state: string | null,
  person: string,
  config: Config,
) {
  const f = flowSchema.safeParse(openCustomer(raw, 'flow', config));
  if (
    !f.success ||
    f.data.person !== person ||
    f.data.state !== state ||
    f.data.expires <= Date.now() / 1000 ||
    f.data.expires > Date.now() / 1000 + 600
  )
    throw new CustomerAccountError(
      'This connection request expired or the signed-in account changed. Start again.',
    );
  return f.data;
}
const idClaims = z.object({
  iss: text,
  aud: z.union([text, z.array(text).min(1)]),
  azp: text.optional(),
  sub: text,
  nonce: text,
  exp: z.number().int(),
  iat: z.number().int(),
});
async function verifyIdToken(token: string, nonce: string, d: Discovery, config: Config) {
  const parts = token.split('.');
  if (parts.length !== 3 || token.length > 16000)
    throw new CustomerAccountError('Shopify identity could not be verified.');
  const header = z
    .object({ alg: z.enum(['RS256', 'ES256']), kid: text, crit: z.never().optional() })
    .parse(JSON.parse(Buffer.from(parts[0]!, 'base64url').toString()));
  const claims = idClaims.parse(JSON.parse(Buffer.from(parts[1]!, 'base64url').toString()));
  const jwks = z
    .object({ keys: z.array(z.record(z.string(), z.unknown())).max(20) })
    .parse(await json(d.jwks));
  const key = jwks.keys.find(
    (k) =>
      k.kid === header.kid &&
      (!k.alg || k.alg === header.alg) &&
      (!k.use || k.use === 'sig') &&
      (!k.key_ops || (Array.isArray(k.key_ops) && k.key_ops.includes('verify'))) &&
      (header.alg !== 'ES256' || k.crv === 'P-256') &&
      k.kty === (header.alg === 'RS256' ? 'RSA' : 'EC'),
  );
  if (
    !key ||
    !verify(
      'sha256',
      Buffer.from(`${parts[0]}.${parts[1]}`),
      {
        key: createPublicKey({ key: key as import('node:crypto').JsonWebKey, format: 'jwk' }),
        ...(header.alg === 'ES256' ? { dsaEncoding: 'ieee-p1363' as const } : {}),
      },
      Buffer.from(parts[2]!, 'base64url'),
    )
  )
    throw new CustomerAccountError('Shopify identity could not be verified.');
  const audience = typeof claims.aud === 'string' ? [claims.aud] : claims.aud,
    now = Date.now() / 1000;
  if (
    claims.iss !== d.issuer ||
    !audience.includes(config.client) ||
    audience.some((value) => value !== config.client) ||
    (audience.length > 1 && claims.azp !== config.client) ||
    (claims.azp && claims.azp !== config.client) ||
    claims.nonce !== nonce ||
    claims.exp <= now ||
    claims.iat > now + 30
  )
    throw new CustomerAccountError('Shopify identity could not be verified.');
}
const identitySchema = z.object({
  data: z.object({
    customer: z.object({
      id: z.string().regex(/^gid:\/\/shopify\/Customer\/[0-9]+$/),
      displayName: z.string().max(1000),
    }),
  }),
  errors: z.array(z.unknown()).optional(),
});
export async function completeCustomerConnection(
  person: string,
  raw: string | undefined,
  state: string | null,
  code: string | null,
  config: Config,
) {
  const flow = validateCustomerFlow(raw, state, person, config);
  if (!code || code.length > 2000)
    throw new CustomerAccountError('The connection could not be confirmed. Start again.');
  const d = await discoverCustomer(config);
  const tokens = z
    .object({
      access_token: z.string().min(1).max(2500),
      id_token: z.string().min(1).max(16000),
      expires_in: z.number().int().positive(),
    })
    .parse(
      await json(d.token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: config.client,
          redirect_uri: config.redirect,
          code,
          code_verifier: flow.verifier,
        }),
      }),
    );
  await verifyIdToken(tokens.id_token, flow.nonce, d, config);
  const result = identitySchema.parse(
    await json(d.graphql, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: tokens.access_token },
      body: JSON.stringify({ query: 'query GentCustomerIdentity { customer { id displayName } }' }),
    }),
  );
  if (result.errors?.length)
    throw new CustomerAccountError('Shopify identity could not be verified.');
  const seconds = Math.min(tokens.expires_in, 3600);
  const session = {
    person,
    customer: result.data.customer.id,
    displayName: result.data.customer.displayName.slice(0, 120),
    access: tokens.access_token,
    expires: Math.floor(Date.now() / 1000) + seconds,
  };
  return { cookie: sealCustomer(session, 'account', config), seconds };
}
const sessionSchema = z.object({
  person: z.uuid(),
  customer: z.string().regex(/^gid:\/\/shopify\/Customer\/[0-9]+$/),
  displayName: z.string().max(120),
  access: z.string().min(1).max(2500),
  expires: z.number().int(),
});
export function customerSession(raw: string | undefined, person: string, config: Config) {
  const s = sessionSchema.safeParse(openCustomer(raw, 'account', config));
  return s.success &&
    s.data.person === person &&
    s.data.expires > Date.now() / 1000 &&
    s.data.expires <= Date.now() / 1000 + 3600
    ? s.data
    : null;
}
const orderSchema = z.object({
  id: z.string().regex(/^gid:\/\/shopify\/Order\/[0-9]+$/),
  name: z.string().max(100),
  processedAt: z.iso.datetime({ offset: true }),
  cancelledAt: z.iso.datetime({ offset: true }).nullable(),
  financialStatus: z.string().max(100).nullable(),
  fulfillmentStatus: z.string().max(100),
  totalPrice: z.object({
    amount: z
      .string()
      .regex(/^\d+(?:\.\d+)?$/)
      .max(30),
    currencyCode: z.string().regex(/^[A-Z]{3}$/),
  }),
});
export type CustomerOrder = z.infer<typeof orderSchema>;
export type CustomerOrdersView = {
  state: 'unconfigured' | 'signed-out' | 'disconnected' | 'connected' | 'unavailable';
  displayName?: string;
  orders?: CustomerOrder[];
  more?: boolean;
};
export async function readCustomerOrders(
  session: NonNullable<ReturnType<typeof customerSession>>,
  config: Config,
) {
  const d = await discoverCustomer(config);
  const result = z
    .object({
      data: z.object({
        customer: z.object({
          id: z.string(),
          orders: z.object({
            nodes: z.array(orderSchema).max(10),
            pageInfo: z.object({ hasNextPage: z.boolean() }),
          }),
        }),
      }),
      errors: z.array(z.unknown()).optional(),
    })
    .parse(
      await json(d.graphql, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: session.access },
        body: JSON.stringify({
          query:
            'query GentRecentOrders { customer { id orders(first: 10, sortKey: PROCESSED_AT, reverse: true) { pageInfo { hasNextPage } nodes { id name processedAt cancelledAt financialStatus fulfillmentStatus totalPrice { amount currencyCode } } } } }',
        }),
      }),
    );
  if (result.errors?.length || result.data.customer.id !== session.customer)
    throw new CustomerAccountError('The connected Shopify account could not be confirmed.');
  return {
    state: 'connected' as const,
    displayName: session.displayName,
    orders: result.data.customer.orders.nodes,
    more: result.data.customer.orders.pageInfo.hasNextPage,
  };
}
