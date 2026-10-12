import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mock = vi.hoisted(() => ({
  founder: vi.fn(),
  session: vi.fn(),
  queries: [] as [string, string, unknown][],
  missing: false,
}));
vi.mock('@/domains/access/founder', () => ({ currentFounderAccess: mock.founder }));
vi.mock('@/domains/intelligence/service', () => ({
  IntelligenceError: class extends Error {
    constructor(
      message: string,
      public status = 400,
    ) {
      super(message);
    }
  },
  intelligenceSession: mock.session,
}));
import { preflightConfiguration } from '@/domains/live/preflight';
import { inspectProviderMetadata, readLivePreflight } from '@/domains/live/preflight-service';
import { GET, POST } from '@/app/api/aethelios/live/preflight/route';
const env = {
  APP_ENV: 'preview',
  VERCEL_ENV: 'preview',
  AETHELIOS_LIVE_ENABLED: 'true',
  AETHELIOS_LIVE_CONTROL_READY: 'true',
  OPENAI_API_KEY: 'PRIVATE_PROVIDER_KEY',
};
beforeEach(() => {
  vi.clearAllMocks();
  mock.queries = [];
  mock.missing = false;
  mock.founder.mockResolvedValue(true);
  mock.session.mockResolvedValue({
    person: { id: 'verified-owner' },
    client: {
      from: (table: string) => {
        const query = {
          select: (columns: string) => {
            mock.queries.push([table, 'select', columns]);
            return query;
          },
          eq: (key: string, value: string) => {
            mock.queries.push([table, key, value]);
            return query;
          },
          limit: (limit: number) => {
            mock.queries.push([table, 'limit', limit]);
            return query;
          },
          abortSignal: async () => ({
            error: mock.missing ? { message: 'PRIVATE DB ERROR' } : null,
            data: [],
          }),
        };
        return query;
      },
    },
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it('keeps configured credentials separate from admission and launch acceptance, rejecting production/invalid combinations', () => {
  const report = preflightConfiguration(env);
  expect(report.admissionConfigured).toBe(true);
  expect(report.launchAcceptance).toBe('unverified');
  expect(JSON.stringify(report)).not.toContain('PRIVATE_PROVIDER_KEY');
  expect(
    preflightConfiguration({ ...env, AETHELIOS_LIVE_CONTROL_READY: 'false' }).admissionConfigured,
  ).toBe(false);
  expect(
    preflightConfiguration({
      ...env,
      APP_ENV: 'production',
      VERCEL_ENV: 'production',
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'synthetic-publishable',
    }).admissionConfigured,
  ).toBe(false);
  expect(preflightConfiguration({ ...env, APP_ENV: 'local' }).environment).toBe('invalid');
  expect(
    preflightConfiguration({ ...env, AETHELIOS_LIVE_MODEL: 'https://attacker.test/SECRET' }).model,
  ).toBeNull();
  expect(
    JSON.stringify(preflightConfiguration({ ...env, VERCEL_GIT_COMMIT_SHA: 'PRIVATE VALUE' })),
  ).not.toContain('PRIVATE VALUE');
});
it('denies non-founders before any configuration/database/provider work', async () => {
  mock.founder.mockResolvedValue(false);
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  expect((await GET()).status).toBe(403);
  expect(mock.session).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
  await expect(readLivePreflight(true)).rejects.toMatchObject({ status: 403 });
});
it('uses owner-scoped zero-row queries and no automatic provider call or privileged RPC', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const report = await readLivePreflight();
  expect(report.provider.status).toBe('not-checked');
  expect(fetch).not.toHaveBeenCalled();
  for (const table of ['ai_live_sessions', 'ai_conversation_artifacts', 'ai_action_proposals']) {
    expect(mock.queries).toContainEqual([table, 'person_id', 'verified-owner']);
    expect(mock.queries).toContainEqual([table, 'limit', 0]);
  }
  expect(report.schema.every((row) => row.status === 'readable')).toBe(true);
  mock.missing = true;
  const unavailable = await readLivePreflight();
  expect(unavailable.schema.every((row) => row.status === 'unavailable')).toBe(true);
  expect(JSON.stringify(unavailable)).not.toContain('PRIVATE DB ERROR');
});
it('requires explicit same-origin provider checks and rejects arbitrary URLs/model/credential overrides', async () => {
  const request = (body: unknown, origin = 'https://example.test') =>
    new Request('https://example.test/api/aethelios/live/preflight', {
      method: 'POST',
      headers: { origin, host: 'example.test', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  expect((await POST(request({ checkProvider: true }, 'https://attacker.test'))).status).toBe(403);
  expect((await POST(request({ checkProvider: true, url: 'https://attacker.test' }))).status).toBe(
    400,
  );
  expect((await POST(request({ checkProvider: false }))).status).toBe(400);
  expect(mock.session).not.toHaveBeenCalled();
});
it('uses only the fixed OpenAI read endpoint and excludes keys/raw model metadata from the DTO', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      Response.json({ id: 'gpt-realtime', object: 'model', owned_by: 'PRIVATE OWNER' }),
    );
  const probe = await inspectProviderMetadata(env, fetch);
  expect(probe.status).toBe('metadata-accessible');
  expect(fetch).toHaveBeenCalledWith(
    'https://api.openai.com/v1/models/gpt-realtime',
    expect.objectContaining({
      headers: { Authorization: 'Bearer PRIVATE_PROVIDER_KEY' },
      cache: 'no-store',
      redirect: 'error',
    }),
  );
  expect(JSON.stringify(probe)).not.toMatch(/PRIVATE_PROVIDER_KEY|PRIVATE OWNER/);
  const none = vi.fn();
  expect((await inspectProviderMetadata({}, none)).status).toBe('missing-key');
  expect(
    (await inspectProviderMetadata({ ...env, AETHELIOS_LIVE_MODEL: 'PRIVATE INVALID MODEL' }, none))
      .status,
  ).toBe('unsupported-model');
  expect(none).not.toHaveBeenCalled();
});
it('redacts provider/transport failures, distinguishes forbidden metadata and bounds response bodies', async () => {
  for (const [status, result] of [
    [401, 'credential-rejected'],
    [403, 'metadata-forbidden'],
    [404, 'model-not-found'],
    [429, 'rate-limited'],
    [500, 'provider-error'],
  ] as const) {
    const fetch = vi.fn().mockResolvedValue(new Response('PRIVATE PROVIDER ERROR', { status }));
    const probe = await inspectProviderMetadata(env, fetch);
    expect(probe.status).toBe(result);
    expect(JSON.stringify(probe)).not.toContain('PRIVATE PROVIDER ERROR');
  }
  expect(
    (
      await inspectProviderMetadata(
        env,
        vi.fn().mockRejectedValue(new Error('PRIVATE KEY AND URL')),
      )
    ).status,
  ).toBe('network-error');
  expect(
    (await inspectProviderMetadata(env, vi.fn().mockResolvedValue(new Response('x'.repeat(17000)))))
      .status,
  ).toBe('invalid-response');
  expect(
    (
      await inspectProviderMetadata(
        env,
        vi.fn().mockResolvedValue(Response.json({ id: 'different-model', object: 'model' })),
      )
    ).status,
  ).toBe('invalid-response');
});
it('returns no-store founder receipts and never promotes an accessible model into launch readiness', async () => {
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(Response.json({ id: 'gpt-realtime', object: 'model' })),
  );
  const response = await POST(
    new Request('https://example.test/api/aethelios/live/preflight', {
      method: 'POST',
      headers: {
        origin: 'https://example.test',
        host: 'example.test',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ checkProvider: true }),
    }),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toContain('no-store');
  const body = await response.json();
  expect(body.provider.status).toBe('metadata-accessible');
  expect(body.launchAcceptance).toBe('unverified');
  expect(JSON.stringify(body)).not.toContain('PRIVATE_PROVIDER_KEY');
});
