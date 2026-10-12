import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mock = vi.hoisted(() => vi.fn());
vi.mock('../src/domains/health/service', () => ({
  exportHealth: mock,
  verifyHealthOwner: vi.fn(),
}));
import { POST } from '../src/app/api/health/export/route';
beforeEach(() => mock.mockReset());
describe('private streamed Health export', () => {
  const request = () =>
    new Request('https://aethelios.test/api/health/export', {
      method: 'POST',
      headers: {
        origin: 'https://aethelios.test',
        host: 'aethelios.test',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ request: crypto.randomUUID() }),
    });
  it('streams valid JSON without buffering an oversized response and preserves private attachment headers', async () => {
    mock.mockResolvedValue(
      (async function* () {
        yield '{"originals":[';
        yield '{"base64":"synthetic"}';
        yield ']}';
      })(),
    );
    const response = await POST(request());
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('content-disposition')).toContain('attachment');
    expect(await response.json()).toEqual({ originals: [{ base64: 'synthetic' }] });
  });
  it('does not label a partial export as complete JSON', async () => {
    mock.mockResolvedValue(
      (async function* () {
        yield '{"originals":[';
        throw new Error('Synthetic unavailable original');
      })(),
    );
    const response = await POST(request());
    await expect(response.json()).rejects.toThrow(/interrupted/);
  });
});
