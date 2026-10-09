import { describe, it, expect, vi, beforeEach } from 'vitest';
const mocks = vi.hoisted(() => ({
  readSchedule: vi.fn(),
  complete: vi.fn(),
  readWebsite: vi.fn(),
  save: vi.fn(),
  prepare: vi.fn(),
  generate: vi.fn(),
  finish: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/domains/business-connections/service', () => ({
  readSchedule: mocks.readSchedule,
  completeConnection: mocks.complete,
  readWebsite: mocks.readWebsite,
  saveBusinessSource: mocks.save,
}));
vi.mock('@/domains/intelligence/service', () => ({
  prepareReply: mocks.prepare,
  IntelligenceError: class extends Error {
    constructor(
      message: string,
      public status = 400,
    ) {
      super(message);
    }
  },
}));
vi.mock('@/domains/intelligence/model', () => ({ generateReply: mocks.generate }));
import { GET as callback } from '@/app/api/business-connections/callback/route';
import { POST as askSchedule } from '@/app/api/business-connections/ask/route';
import { POST as askWebsite } from '@/app/api/business-connections/ask-website/route';
const id = '10000000-0000-4000-8000-000000000001',
  company = '10000000-0000-4000-8000-000000000002';
const body = {
  connectionId: id,
  conversationId: id,
  requestId: id,
  text: 'Review the source',
  consent: true,
};
const request = (input: unknown, origin = 'https://public.example') =>
  new Request('https://public.example/api/business-connections/ask', {
    method: 'POST',
    headers: { host: 'public.example', origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.finish.mockResolvedValue({ id });
  mocks.prepare.mockResolvedValue({ model: 'existing-model', messages: [], finish: mocks.finish });
  mocks.save.mockResolvedValue(undefined);
  mocks.readSchedule.mockResolvedValue({
    connection: { id, company_id: company },
    schedule: { source: 'Legacy Reserve', date: '2026-10-10', days: 1, page: 0, appointments: [] },
  });
  mocks.readWebsite.mockResolvedValue({
    connection: { id, company_id: company },
    source: {
      websiteId: 'fix-it-shop',
      revision: 1,
      content: { headline: 'Synthetic', about: 'Synthetic' },
      services: [],
      proposals: [],
      fetchedAt: '2026-10-10T12:00:00Z',
    },
  });
  mocks.generate.mockImplementation(async function* () {
    yield { type: 'text', text: 'Synthetic draft' };
    yield { type: 'finish', reason: 'stop' };
  });
});
describe('AI business gateway', () => {
  it('rejects cross-origin and nonconsensual requests before reserving a turn or calling a model', async () => {
    for (const input of [
      { ...body, consent: false },
      { ...body, includeContext: true },
      { ...body, companyId: company },
    ]) {
      const r = await askWebsite(request(input));
      expect(r.ok).toBe(false);
    }
    expect((await askWebsite(request(body, 'https://evil.example'))).status).toBe(403);
    expect(mocks.readWebsite).not.toHaveBeenCalled();
    expect(mocks.prepare).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it('uses the server-owned company, fresh read and existing AI pipeline with personal context disabled', async () => {
    const r = await askSchedule(
      request({ ...body, window: { date: '2026-10-10', days: 1, page: 0 } }),
    );
    const stream = await r.text();
    expect(stream).toContain('"type":"saved"');
    expect(mocks.prepare).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: company, includeContext: false }),
    );
    expect(mocks.generate).toHaveBeenCalledTimes(1);
    expect(mocks.save).toHaveBeenCalledWith(
      id,
      id,
      expect.objectContaining({ source: 'Legacy Reserve' }),
    );
  });
  it('does not dispatch a model after remote denial or failed source persistence', async () => {
    mocks.readWebsite.mockRejectedValueOnce(Error('remote denied'));
    expect((await askWebsite(request(body))).ok).toBe(false);
    expect(mocks.prepare).not.toHaveBeenCalled();
    mocks.save.mockRejectedValueOnce(Error('snapshot unavailable'));
    expect((await askWebsite(request(body))).status).toBe(503);
    expect(mocks.finish).toHaveBeenCalledWith('', 'failed');
    expect(mocks.generate).not.toHaveBeenCalled();
  });
});

it('OAuth return redirects safely on success or failure and never reflects codes', async () => {
  mocks.complete.mockResolvedValueOnce(id);
  const success = await callback(
    new Request('https://public.example/api/business-connections/callback?code=private-code'),
  );
  expect(success.status).toBe(303);
  expect(success.headers.get('location')).toBe('/app/business-connections');
  mocks.complete.mockRejectedValueOnce(Error('private-provider-details'));
  const failure = await callback(
    new Request('https://public.example/api/business-connections/callback?code=private-code'),
  );
  expect(failure.status).toBe(303);
  expect(failure.headers.get('location')).toBe('/app/business-connections?connection=failed');
  expect(failure.headers.get('referrer-policy')).toBe('no-referrer');
  expect(await failure.text()).not.toContain('private');
});
