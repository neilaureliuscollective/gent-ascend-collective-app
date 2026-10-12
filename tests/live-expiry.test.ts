import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/domains/intelligence/service', () => ({
  intelligenceSession: vi.fn(),
  IntelligenceError: class extends Error {},
}));
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), create: vi.fn(), metadata: vi.fn() }));
vi.mock('@/domains/live/preflight-service', () => ({ inspectProviderMetadata: mocks.metadata }));
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.create }));
vi.mock('@/platform/supabase/connection', () => ({
  supabaseConnection: () => ({ url: 'http://127.0.0.1:54321', key: 'synthetic-public' }),
}));
import { tag } from '@/domains/live/cleanup';
import { sweepExpiredLive } from '@/domains/live/expiry';
import { GET, POST } from '@/app/api/internal/live-expiry/route';
const secret = 'synthetic-cron-secret-with-32-characters';
const key = 'synthetic-provider-key';
const row = {
  id: 'f1000000-0000-4000-8000-000000000001',
  person_id: 'f2000000-0000-4000-8000-000000000001',
  lease_token: 'f3000000-0000-4000-8000-000000000001',
  call_id: 'rtc_synthetic',
  expires_at: '2026-01-01T00:00:00Z',
  call_tag: '',
};
row.call_tag = tag(key, row.person_id, row.id, row.call_id);
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('APP_ENV', 'local');
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('VERCEL', '');
  vi.stubEnv('VERCEL_ENV', '');
  vi.stubEnv('AURELIUS_DEV_HARNESS', 'false');
  vi.stubEnv('CRON_SECRET', secret);
  vi.stubEnv('OPENAI_API_KEY', key);
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-worker-key');
  vi.stubEnv('AETHELIOS_LIVE_EXPIRY_ENABLED', 'true');
  mocks.create.mockReturnValue({ rpc: mocks.rpc });
  mocks.rpc.mockImplementation((name: string) => ({
    abortSignal: vi
      .fn()
      .mockResolvedValue({ data: name === 'ai_live_claim_expired' ? [row] : true, error: null }),
  }));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
const request = (authorization?: string) =>
  new Request('https://example.test/api/internal/live-expiry', {
    headers: authorization ? { authorization } : {},
  });
it('rejects missing or incorrect scheduler authority before privileged client creation', async () => {
  expect((await GET(request())).status).toBe(401);
  expect((await GET(request('Bearer wrong'))).status).toBe(401);
  expect(mocks.create).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
it('rejects an unpinned hosted preview before privileged database/provider work', async () => {
  vi.stubEnv('APP_ENV', 'preview');
  vi.stubEnv('AETHELIOS_LIVE_PREVIEW_PROJECT_REF', '');
  await expect(sweepExpiredLive()).rejects.toThrow(/database binding/);
  expect(mocks.create).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
it('stays default off even with valid authority', async () => {
  vi.stubEnv('AETHELIOS_LIVE_EXPIRY_ENABLED', 'false');
  expect((await GET(request(`Bearer ${secret}`))).status).toBe(404);
  expect(mocks.create).not.toHaveBeenCalled();
});
it('requires a sufficiently strong scheduler secret', async () => {
  vi.stubEnv('CRON_SECRET', 'short');
  expect((await GET(request('Bearer short'))).status).toBe(401);
});
it('does not accept caller-selected sessions or commands', async () => {
  const r = new Request('https://example.test/api/internal/live-expiry?sessionId=other', {
    headers: { authorization: `Bearer ${secret}` },
  });
  expect((await GET(r)).status).toBe(400);
  expect(mocks.create).not.toHaveBeenCalled();
});
it('confirms only a server-bound expired call after successful hangup and returns aggregate counts', async () => {
  const r = await GET(request(`Bearer ${secret}`));
  expect(r.status).toBe(200);
  expect(await r.json()).toEqual({ claimed: 1, confirmed: 1, pending: 0 });
  expect(r.headers.get('cache-control')).toContain('no-store');
  expect(mocks.rpc).toHaveBeenCalledWith('ai_live_confirm_expired', {
    p_id: row.id,
    p_token: row.lease_token,
  });
  expect(mocks.rpc.mock.invocationCallOrder[1]).toBeGreaterThan(
    vi.mocked(fetch).mock.invocationCallOrder[0]!,
  );
});
it('leaves a failed provider call leased for retry without recording confirmation', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }));
  expect(await sweepExpiredLive()).toEqual({ claimed: 1, confirmed: 0, pending: 1 });
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
});
it('isolates a malformed binding while allowing a valid leased call to complete', async () => {
  mocks.rpc.mockImplementation((name: string) => ({
    abortSignal: vi.fn().mockResolvedValue({
      data: name === 'ai_live_claim_expired' ? [{ ...row, call_tag: null }, row] : true,
      error: null,
    }),
  }));
  expect(await sweepExpiredLive()).toEqual({ claimed: 2, confirmed: 1, pending: 1 });
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('rejects an unexpired call or tampered owner without a provider request', async () => {
  mocks.rpc.mockImplementation(() => ({
    abortSignal: vi.fn().mockResolvedValue({
      data: [
        { ...row, expires_at: '2099-01-01T00:00:00Z' },
        { ...row, person_id: row.lease_token },
      ],
      error: null,
    }),
  }));
  expect(await sweepExpiredLive()).toEqual({ claimed: 2, confirmed: 0, pending: 2 });
  expect(fetch).not.toHaveBeenCalled();
});
it('does not fabricate confirmation when the database rejects the lease', async () => {
  mocks.rpc.mockImplementation((name: string) => ({
    abortSignal: vi
      .fn()
      .mockResolvedValue({ data: name === 'ai_live_claim_expired' ? [row] : false, error: null }),
  }));
  expect(await sweepExpiredLive()).toEqual({ claimed: 1, confirmed: 0, pending: 1 });
});
it('redacts unexpected provider/database details in route errors', async () => {
  mocks.rpc.mockImplementation(() => {
    throw new Error('synthetic-private-detail');
  });
  const r = await GET(request(`Bearer ${secret}`));
  expect(r.status).toBe(503);
  expect(await r.text()).not.toContain('synthetic-private-detail');
});

const probe = (authorization?: string, body?: string) =>
  new Request('https://example.test/api/internal/live-expiry', {
    method: 'POST',
    headers: authorization ? { authorization } : {},
    body,
  });
function preview() {
  vi.stubEnv('APP_ENV', 'preview');
  vi.stubEnv('AETHELIOS_LIVE_CANONICAL_PILOT', 'true');
  vi.stubEnv('AETHELIOS_LIVE_PREVIEW_PROJECT_REF', undefined);
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://volpzkfsnmtztrovexcw.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'synthetic-public');
}
it('requires operator authority and rejects all input before model metadata access', async () => {
  expect((await POST(probe())).status).toBe(401);
  expect((await POST(probe(`Bearer ${secret}`, '{"model":"other"}'))).status).toBe(400);
  expect(mocks.metadata).not.toHaveBeenCalled();
  expect(mocks.create).not.toHaveBeenCalled();
});
it('checks fixed preview metadata without creating calls, reservations or launch acceptance', async () => {
  preview();
  mocks.metadata.mockResolvedValue({ status: 'metadata-accessible', durationMs: 123 });
  const response = await POST(probe(`Bearer ${secret}`));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    provider: { status: 'metadata-accessible', durationMs: 123 },
    callAcceptance: 'unverified',
  });
  expect(mocks.create).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
it('rejects production and unbound previews before using provider credentials', async () => {
  vi.stubEnv('APP_ENV', 'production');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://volpzkfsnmtztrovexcw.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'synthetic-public');
  expect((await POST(probe(`Bearer ${secret}`))).status).toBe(403);
  vi.stubEnv('APP_ENV', 'preview');
  vi.stubEnv('AETHELIOS_LIVE_CANONICAL_PILOT', 'false');
  vi.stubEnv('AETHELIOS_LIVE_PREVIEW_PROJECT_REF', undefined);
  expect((await POST(probe(`Bearer ${secret}`))).status).toBe(403);
  expect(mocks.metadata).not.toHaveBeenCalled();
});
it('reports inaccessible models as unavailable and redacts unexpected provider errors', async () => {
  preview();
  mocks.metadata.mockResolvedValue({ status: 'model-not-found', durationMs: 123 });
  expect((await POST(probe(`Bearer ${secret}`))).status).toBe(503);
  mocks.metadata.mockRejectedValue(new Error('PRIVATE_PROVIDER_ERROR'));
  const response = await POST(probe(`Bearer ${secret}`));
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain('PRIVATE_PROVIDER_ERROR');
});
