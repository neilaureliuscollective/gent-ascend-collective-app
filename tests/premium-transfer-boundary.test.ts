import { expect, it, vi } from 'vitest';
type Query = {
  select: () => Query;
  eq: () => Query;
  maybeSingle: () => Promise<{ data: unknown; error: null }>;
};
vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({ row: null as unknown, writes: vi.fn() }));
vi.mock('@/domains/intelligence/service', () => ({
  IntelligenceError: class extends Error {
    constructor(
      message: string,
      public status = 400,
    ) {
      super(message);
    }
  },
  intelligenceSession: async () => {
    const query: Query = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => ({ data: state.row, error: null }),
    };
    return { person: { id: 'synthetic-owner' }, client: { from: () => query, rpc: state.writes } };
  },
}));
import { resolveTalkDesignSource } from '@/domains/talk-creation/architect-source';
import { produceArchitectDirection } from '@/domains/talk-creation/architect-direction';
import { lifestyleLaunchBoard } from '@/domains/talk-creation/design-board';

it('refuses premium receipts before any Architect binding while database authority is v1-only', async () => {
  const board = lifestyleLaunchBoard();
  const identity = {
    conversationId: '30000000-0000-4000-8000-000000000031',
    boardId: '50000000-0000-4000-8000-000000000031',
    version: 2,
  };
  state.row = { id: identity.boardId, version: 2, content: board, candidate: false };
  const receipt = produceArchitectDirection({ ...identity, board });
  await expect(resolveTalkDesignSource({ personId: 'synthetic-owner', receipt })).rejects.toThrow(
    /Premium design transfer is not available yet/,
  );
  expect(state.writes).not.toHaveBeenCalled();
});
