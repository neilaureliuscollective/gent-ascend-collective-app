import { it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const service = vi.hoisted(() => ({ save: vi.fn(), generate: vi.fn(), read: vi.fn() }));
vi.mock('@/domains/architect-origin/service', () => ({
  saveOrigin: service.save,
  generateOrigin: service.generate,
  readOrigin: service.read,
}));
vi.mock('@/domains/intelligence/service', () => ({
  IntelligenceError: class extends Error {
    constructor(
      message: string,
      public status = 400,
    ) {
      super(message);
    }
  },
}));
import { POST, GET } from '@/app/api/architect-origin/route';
it('rejects cross-origin mutations and client-controlled ownership before services', async () => {
  const response = await POST(
    new Request('https://example.com/api/architect-origin', {
      method: 'POST',
      headers: {
        host: 'example.com',
        origin: 'https://hostile.com',
        'content-type': 'application/json',
      },
      body: '{}',
    }),
  );
  expect(response.status).toBe(403);
  expect(service.save).not.toHaveBeenCalled();
  expect(service.generate).not.toHaveBeenCalled();
});
it('rejects invalid project/history selectors and disables shared caching', async () => {
  expect(
    (await GET(new Request('https://example.com/api/architect-origin?project=wrong'))).status,
  ).toBe(400);
  expect(
    (await GET(new Request('https://example.com/api/architect-origin?before=-1'))).status,
  ).toBe(400);
  service.read.mockResolvedValue({ projects: [], versions: [], runs: [] });
  const response = await GET(new Request('https://example.com/api/architect-origin'));
  expect(response.headers.get('cache-control')).toBe('private, no-store');
});
