import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ read: vi.fn(), mutate: vi.fn(), upload: vi.fn() }));
vi.mock('../src/domains/health/service', () => ({
  verifyHealthOwner: vi.fn(),
  readHealth: mocks.read,
  mutateHealth: mocks.mutate,
  uploadRecord: mocks.upload,
}));
import { GET, POST } from '../src/app/api/health/route';
import { emptyHealth } from '../src/domains/health/schema';
beforeEach(() => {
  vi.clearAllMocks();
});
describe('Health HTTP boundary', () => {
  it('returns private no-store and rejects signed-out reads', async () => {
    mocks.read.mockResolvedValue(emptyHealth());
    const response = await GET();
    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
  it('rejects hostile origin, oversized bodies and attempts to expand model scope', async () => {
    const body = {
      kind: 'ask',
      request: crypto.randomUUID(),
      question: 'Explain',
      evidence: [],
      consentVersion: 1,
      includeContext: true,
    };
    const request = (payload: unknown, origin = 'https://aethelios.test') =>
      new Request('https://aethelios.test/api/health', {
        method: 'POST',
        headers: { host: 'aethelios.test', origin, 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
    expect((await POST(request(body, 'https://hostile.test'))).status).toBe(403);
    expect((await POST(request(body))).status).toBe(400);
    expect((await POST(request({ text: 'x'.repeat(250001) }))).status).toBe(413);
    expect(mocks.mutate).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  });
});
