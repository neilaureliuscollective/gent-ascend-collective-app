import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/domains/intelligence/service', () => ({
  intelligenceSession: vi.fn(),
  IntelligenceError: class extends Error {},
}));
import { endLive, recoverExpiredLive, tag } from '@/domains/live/cleanup';
const owner = 'synthetic-owner';
const id = 'synthetic-session';
const key = 'synthetic-key';
const call = 'rtc_synthetic';
function fixture(rows: { id: string }[] = []) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: rows, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({
      data: { call_id: call, call_tag: tag(key, owner, id, call) },
      error: null,
    }),
  };
  const client = {
    from: vi.fn().mockReturnValue(query),
    rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
  };
  return { query, client, session: { client, person: { id: owner } } as never };
}
beforeEach(() => {
  vi.stubEnv('OPENAI_API_KEY', key);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it('hangs up only the server-signed owned call before recording cleanup', async () => {
  const f = fixture();
  await endLive(id, f.session);
  expect(f.query.eq).toHaveBeenCalledWith('person_id', owner);
  expect(fetch).toHaveBeenCalledWith(
    'https://api.openai.com/v1/realtime/calls/rtc_synthetic/hangup',
    expect.objectContaining({ redirect: 'error' }),
  );
  expect(vi.mocked(fetch).mock.invocationCallOrder[0]).toBeLessThan(
    f.client.rpc.mock.invocationCallOrder[0]!,
  );
});
it.each([401, 429, 500])('leaves cleanup unconfirmed when provider returns %s', async (status) => {
  const f = fixture();
  vi.mocked(fetch).mockResolvedValue(new Response(null, { status }));
  await expect(endLive(id, f.session)).rejects.toThrow(/cleanup/);
  expect(f.client.rpc).not.toHaveBeenCalled();
});
it.each([404, 410])('records cleanup for an already absent call (%s)', async (status) => {
  const f = fixture();
  vi.mocked(fetch).mockResolvedValue(new Response(null, { status }));
  await endLive(id, f.session);
  expect(f.client.rpc).toHaveBeenCalled();
});
it('rejects a call binding signed for another owner before provider work', async () => {
  const f = fixture();
  f.query.maybeSingle.mockResolvedValue({
    data: { call_id: call, call_tag: tag(key, 'other', id, call) },
    error: null,
  });
  await expect(endLive(id, f.session)).rejects.toThrow(/verified/);
  expect(fetch).not.toHaveBeenCalled();
  expect(f.client.rpc).not.toHaveBeenCalled();
});
it('does not report confirmation when the owner RPC affects no session', async () => {
  const f = fixture();
  f.client.rpc.mockResolvedValue({ data: false, error: null });
  await expect(endLive(id, f.session)).rejects.toThrow(/recorded/);
});
it('recovers expired sessions through normal owner filters only', async () => {
  const f = fixture([{ id }]);
  await recoverExpiredLive(f.session);
  expect(f.query.eq).toHaveBeenCalledWith('person_id', owner);
  expect(f.query.is).toHaveBeenCalledWith('ended_at', null);
  expect(f.query.lte).toHaveBeenCalledWith('expires_at', expect.any(String));
  expect(f.query.limit).toHaveBeenCalledWith(11);
  expect(f.client.rpc).toHaveBeenCalledWith('ai_live_end', { p_id: id, p_reason: 'ended' });
});
it('fails closed on an unchecked backlog without provider work', async () => {
  const f = fixture(Array.from({ length: 11 }, () => ({ id })));
  await expect(recoverExpiredLive(f.session)).rejects.toThrow(/review/);
  expect(fetch).not.toHaveBeenCalled();
});
