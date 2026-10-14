import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const state = vi.hoisted(() => ({
  owner: '00000000-0000-4000-8000-000000000001',
  projectId: '90000000-0000-4000-8000-000000000111',
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

import { DESIGN_DIRECTION_SCHEMA } from '@/domains/architect-design-direction/contract';
import { designDirectionStore, receiveDesignDirection } from '@/domains/architect-design-direction/receiver';
import {
  createTalkAuthorizedSourceAdapter,
  registerTalkSourceAdapter,
} from '@/domains/architect-design-direction/talk-source';
import { MemoryDesignDirectionStore } from '@/domains/architect-design-direction/store';
import { produceArchitectDirection } from '@/domains/talk-creation/architect-direction';
import { legacyReserveBoard, selectDesignDirection } from '@/domains/talk-creation/design-board';

const conversation = '30000000-0000-4000-8000-000000000201';
const boardId = '50000000-0000-4000-8000-000000000201';
const requestId = '80000000-0000-4000-8000-000000000201';

beforeEach(() => {
  vi.stubEnv('ARCHITECT_ORIGIN_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_APPS_STORE', 'memory');
  (designDirectionStore() as MemoryDesignDirectionStore).rows.clear();
  const receipt = produceArchitectDirection({
    conversationId: conversation,
    boardId,
    version: 2,
    board: selectDesignDirection(legacyReserveBoard(), 'direction-c'),
  });
  registerTalkSourceAdapter(
    createTalkAuthorizedSourceAdapter(async () => ({
      kind: 'talk-authorized',
      digest: receipt.digest,
      receipt,
      note: 'Verified from owner-authorized Talk records.',
    })),
  );
});

it('retries the shared receiver into one private project for the selected Talk direction', async () => {
  const receipt = produceArchitectDirection({
    conversationId: conversation,
    boardId,
    version: 2,
    board: selectDesignDirection(legacyReserveBoard(), 'direction-c'),
  });
  expect(receipt.schema).toBe(DESIGN_DIRECTION_SCHEMA);
  const command = {
    action: 'receive' as const,
    requestId,
    projectId: state.projectId,
    receipt,
  };
  const first = await receiveDesignDirection(command);
  const second = await receiveDesignDirection(command);
  expect(first.project_id).toBe(state.projectId);
  expect(second.request_id).toBe(first.request_id);
  expect(first.started).toBe(false);
  expect(first.source_kind).toBe('talk-authorized');
  expect(first.verified).toBe(true);
  expect(first.digest).toBe(receipt.digest);
  expect([...((designDirectionStore() as MemoryDesignDirectionStore).rows.values())]).toHaveLength(1);
});
