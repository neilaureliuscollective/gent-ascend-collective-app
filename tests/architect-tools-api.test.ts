import { expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const service = vi.hoisted(() => ({ save: vi.fn(), read: vi.fn(), invoke: vi.fn() }));
vi.mock('@/domains/architect-origin/service', () => ({ originReady: () => true }));
vi.mock('@/domains/architect-tools/service', () => ({
  saveArchitectTool: service.save,
  readArchitectTools: service.read,
  invokeArchitectTool: service.invoke,
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
import { GET, POST } from '@/app/api/architect-tools/route';
import { sampleEstimatorConfig } from '@/domains/architect-tools/engine';

it('rejects cross-origin tool mutations and forged owner fields', async () => {
  const hostile = await POST(
    new Request('https://example.com/api/architect-tools', {
      method: 'POST',
      headers: {
        host: 'example.com',
        origin: 'https://hostile.com',
        'content-type': 'application/json',
      },
      body: '{}',
    }),
  );
  expect(hostile.status).toBe(403);
  expect(service.save).not.toHaveBeenCalled();
  const forged = await POST(
    new Request('https://example.com/api/architect-tools', {
      method: 'POST',
      headers: {
        host: 'example.com',
        origin: 'https://example.com',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        action: 'save',
        projectId: '00000000-0000-4000-8000-000000000003',
        toolId: '00000000-0000-4000-8000-000000000030',
        requestId: '00000000-0000-4000-8000-000000000031',
        expected: 0,
        name: 'Estimator',
        configuration: sampleEstimatorConfig(),
        note: 'Save',
        personId: 'forged-owner',
      }),
    }),
  );
  expect(forged.status).toBe(400);
  expect(service.save).not.toHaveBeenCalled();
});

it('requires a project selector and keeps reads private', async () => {
  expect((await GET(new Request('https://example.com/api/architect-tools'))).status).toBe(400);
  service.read.mockResolvedValue({ tools: [], versions: [], invocations: [] });
  const response = await GET(
    new Request('https://example.com/api/architect-tools?project=00000000-0000-4000-8000-000000000003'),
  );
  expect(response.headers.get('cache-control')).toBe('private, no-store');
});
