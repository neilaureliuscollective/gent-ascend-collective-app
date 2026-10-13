import { expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const service = vi.hoisted(() => ({
  read: vi.fn(),
  start: vi.fn(),
  fixture: vi.fn(),
  cancel: vi.fn(),
}));
vi.mock('@/domains/architect-construct/service', () => ({
  readConstruct: service.read,
  startConstruct: service.start,
  startFixtureConstruct: service.fixture,
  cancelConstruct: service.cancel,
  constructStore: () => ({ claimRun: vi.fn() }),
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
import { GET, POST } from '@/app/api/architect-construct/route';
import { GET as workerGet, POST as workerPost } from '@/app/api/internal/architect-construct/route';

it('rejects cross-origin mutations and forged ownership fields', async () => {
  const denied = await POST(
    new Request('https://example.com/api/architect-construct', {
      method: 'POST',
      headers: {
        host: 'example.com',
        origin: 'https://hostile.com',
        'content-type': 'application/json',
      },
      body: '{}',
    }),
  );
  expect(denied.status).toBe(403);
  expect(service.fixture).not.toHaveBeenCalled();
  const forged = await POST(
    new Request('https://example.com/api/architect-construct', {
      method: 'POST',
      headers: {
        host: 'example.com',
        origin: 'https://example.com',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        action: 'start-fixture',
        projectId: crypto.randomUUID(),
        requestId: crypto.randomUUID(),
        expected: 1,
        personId: 'forged',
      }),
    }),
  );
  expect(forged.status).toBe(400);
  expect(service.fixture).not.toHaveBeenCalled();
});

it('rejects invalid project selectors and keeps receipts private', async () => {
  expect((await GET(new Request('https://example.com/api/architect-construct'))).status).toBe(400);
  service.read.mockResolvedValue({ project: {}, runs: [], events: {}, briefs: [], sources: [] });
  const response = await GET(
    new Request(`https://example.com/api/architect-construct?project=${crypto.randomUUID()}`),
  );
  expect(response.headers.get('cache-control')).toBe('private, no-store');
});

it('hides the worker route in production-like configuration and without a token', async () => {
  vi.stubEnv('ARCHITECT_ORIGIN_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_CONSTRUCT_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_CONSTRUCT_WORKER_TOKEN', 'x'.repeat(32));
  vi.stubEnv('APP_ENV', 'production');
  vi.stubEnv('NODE_ENV', 'production');
  expect((await workerGet()).status).toBe(404);
  expect(
    (
      await workerPost(
        new Request('https://example.com/api/internal/architect-construct', {
          method: 'POST',
          headers: { authorization: `Bearer ${'x'.repeat(32)}` },
        }),
      )
    ).status,
  ).toBe(404);
  vi.stubEnv('APP_ENV', 'local');
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('VERCEL', '');
  vi.stubEnv('VERCEL_ENV', '');
  expect(
    (
      await workerPost(
        new Request('https://example.com/api/internal/architect-construct', {
          method: 'POST',
          headers: { authorization: 'Bearer wrong-token-wrong-token-wrong' },
        }),
      )
    ).status,
  ).toBe(401);
  expect(
    (
      await workerPost(
        new Request('https://example.com/api/internal/architect-construct', {
          method: 'POST',
          headers: { authorization: `Bearer ${'x'.repeat(32)}` },
        }),
      )
    ).status,
  ).toBe(409);
});
