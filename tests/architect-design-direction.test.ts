import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({
  owner: '00000000-0000-4000-8000-000000000001',
  projectId: '00000000-0000-4000-8000-000000000111',
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
    person: { id: state.owner },
    client: {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { id: state.projectId }, error: null }),
            }),
          }),
        }),
      }),
      rpc: async () => ({ data: 1, error: null }),
    },
  }),
}));
import {
  DESIGN_DIRECTION_SCHEMA,
  designDirectionDigest,
  mapTextHandoffToDirection,
} from '@/domains/architect-design-direction/contract';
import { designDirectionStore, receiveDesignDirection } from '@/domains/architect-design-direction/receiver';
import { MemoryDesignDirectionStore } from '@/domains/architect-design-direction/store';

function receipt(projectName = 'Tracker direction') {
  const identity = {
    conversationId: '00000000-0000-4000-8000-000000000201',
    boardId: '00000000-0000-4000-8000-000000000202',
    boardVersion: 1,
    directionId: '00000000-0000-4000-8000-000000000203',
  };
  const content = mapTextHandoffToDirection({
    identity,
    name: projectName,
    summary: 'A private project tracker direction imported from Talk text.',
    title: 'Project tracker',
  });
  const sourceRecords = [{ kind: 'handoff' as const, id: identity.directionId, revision: 1 }];
  return {
    schema: DESIGN_DIRECTION_SCHEMA,
    identity,
    content,
    digest: designDirectionDigest(content, sourceRecords),
    sourceRecords,
  };
}

beforeEach(() => {
  vi.stubEnv('ARCHITECT_ORIGIN_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_APPS_STORE', 'memory');
  const store = designDirectionStore() as MemoryDesignDirectionStore;
  store.rows.clear();
});

it('retries the same request into exactly one private project and never starts execution', async () => {
  const command = {
    action: 'receive' as const,
    requestId: '00000000-0000-4000-8000-000000000301',
    projectId: state.projectId,
    receipt: receipt(),
  };
  const first = await receiveDesignDirection(command);
  const second = await receiveDesignDirection(command);
  expect(first.project_id).toBe(state.projectId);
  expect(second.request_id).toBe(first.request_id);
  expect(first.started).toBe(false);
  expect(second.started).toBe(false);
  expect(first.source_kind).toBe('text-import');
  expect(first.verified).toBe(true);
  expect([...((designDirectionStore() as MemoryDesignDirectionStore).rows.values())]).toHaveLength(1);
});

it('does not invent a Talk store when the authorized source adapter is pending', async () => {
  const identity = {
    conversationId: '00000000-0000-4000-8000-000000000211',
    boardId: '00000000-0000-4000-8000-000000000212',
    boardVersion: 1,
    directionId: '00000000-0000-4000-8000-000000000213',
  };
  const content = {
    ...mapTextHandoffToDirection({
      identity,
      name: 'Talk board direction',
      summary: 'A Talk-owned board that Architect cannot invent.',
      title: 'Talk board',
    }),
  };
  delete (content as { compatibleTextImport?: string }).compatibleTextImport;
  const sourceRecords = [{ kind: 'direction' as const, id: identity.directionId, revision: 1 }];
  await expect(
    receiveDesignDirection({
      action: 'receive',
      requestId: '00000000-0000-4000-8000-000000000303',
      projectId: state.projectId,
      receipt: {
        schema: DESIGN_DIRECTION_SCHEMA,
        identity,
        content,
        digest: designDirectionDigest(content, sourceRecords),
        sourceRecords,
      },
    }),
  ).rejects.toThrow(/Talk authorized source adapter is pending/i);
});

it('refuses a client-supplied digest that does not match server-authorized records', async () => {
  const forged = receipt();
  forged.digest = 'a'.repeat(64);
  await expect(
    receiveDesignDirection({
      action: 'receive',
      requestId: '00000000-0000-4000-8000-000000000302',
      projectId: state.projectId,
      receipt: forged,
    }),
  ).rejects.toThrow(/client-supplied hash is not authority/i);
});
