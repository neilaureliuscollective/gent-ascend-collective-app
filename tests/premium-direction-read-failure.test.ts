import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/domains/architect-design-direction/receiver', () => ({
  readRetainedDirection: async () => {
    throw new Error('Retained design read failed');
  },
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
  intelligenceSession: async () => ({
    person: { id: '00000000-0000-4000-8000-000000000001' },
    client: {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                error: null,
                data: {
                  id: '00000000-0000-4000-8000-000000000003',
                  person_id: '00000000-0000-4000-8000-000000000001',
                  revision: 1,
                  content: {
                    name: 'Campaign',
                    blueprint: { vision: 'Keep the selected campaign.' },
                  },
                },
              }),
            }),
          }),
        }),
      }),
    },
  }),
}));
import { appStore, proposeArchitectApp } from '@/domains/architect-apps/service';
import type { MemoryAppStore } from '@/domains/architect-apps/store';
beforeEach(() => {
  vi.stubEnv('ARCHITECT_ORIGIN_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_APPS_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_APPS_STORE', 'memory');
  vi.stubEnv('ARCHITECT_APPS_FIXTURE', 'true');
  vi.stubEnv('APP_ENV', 'local');
});
it('blocks proposal creation on a failed retained-direction read, preserving last-good revisions', async () => {
  const store = appStore() as MemoryAppStore;
  const count = store.revisions.size;
  await expect(
    proposeArchitectApp({
      action: 'propose',
      projectId: '00000000-0000-4000-8000-000000000003',
      requestId: '00000000-0000-4000-8000-000000000401',
      expected: 1,
      instruction: 'Build the selected campaign',
      kind: 'create',
      demo: 'tracker',
    }),
  ).rejects.toThrow('Retained design read failed');
  expect(store.revisions.size).toBe(count);
  expect(store.jobs.size).toBe(0);
});
