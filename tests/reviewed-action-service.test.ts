import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mock = vi.hoisted(() => ({
  access: new Set(['voice.use', 'daily.write']),
  rpc: vi.fn(),
  calls: [] as [string, string, string][],
  receipt: null as null | { id: string; title: string; executed_day: string; status: string },
  currentTitle: null as null | string,
}));
vi.mock('@/domains/live/config', () => ({ liveConfig: () => ({}) }));
vi.mock('@/domains/access/current', () => ({ currentAccess: async () => mock.access }));
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
    person: { id: 'verified-owner', timezone: 'UTC' },
    client: {
      rpc: mock.rpc,
      from: (table: string) => {
        const query = {
          select: () => query,
          eq: (key: string, value: string) => {
            mock.calls.push([table, key, value]);
            return query;
          },
          is: () => query,
          maybeSingle: async () => ({
            error: null,
            data:
              table === 'ai_conversations'
                ? { id: conversationId }
                : table === 'ai_conversation_artifacts'
                  ? { visual: board }
                  : table === 'daily_entries'
                    ? { version: 3 }
                    : table === 'ai_artifact_selection'
                      ? { artifact_id: reviewId }
                      : table === 'ai_action_proposals'
                        ? mock.receipt
                        : table === 'daily_actions' && mock.currentTitle
                          ? { id: mock.receipt?.id, title: mock.currentTitle }
                          : null,
          }),
        };
        return query;
      },
    },
  }),
}));
import {
  confirmReviewedAction,
  prepareReviewedAction,
} from '@/domains/artifacts/daily-action-service';
const conversationId = 'a1000000-0000-4000-8000-000000000001',
  reviewId = 'a1000000-0000-4000-8000-000000000002',
  id = 'a1000000-0000-4000-8000-000000000003';
const board = {
  kind: 'review',
  basis: 'coworker',
  title: 'Synthetic review',
  summary: 'Unverified suggestions',
  coworker: 'athena',
  text: 'An AI suggestion should not be a user commitment.',
  contextScope: 'task-only',
  sourceArtifactId: null,
  sourcePartId: null,
};
beforeEach(() => {
  mock.access = new Set(['voice.use', 'daily.write']);
  mock.receipt = null;
  mock.currentTitle = null;
  mock.calls = [];
  mock.rpc.mockReset();
});
it('reads only the verified owner and a personal active completed review; preparation causes no writes', async () => {
  const prepared = await prepareReviewedAction(conversationId, reviewId);
  expect(prepared.receipt).toBeNull();
  expect(prepared.version).toBe(3);
  expect(mock.rpc).not.toHaveBeenCalled();
  for (const table of [
    'ai_conversations',
    'ai_conversation_artifacts',
    'daily_entries',
    'ai_action_proposals',
    'ai_artifact_selection',
  ])
    expect(mock.calls).toContainEqual([table, 'person_id', 'verified-owner']);
  expect(mock.calls).toContainEqual(['ai_conversation_artifacts', 'status', 'complete']);
});
it('denies missing daily permission before database execution', async () => {
  mock.access = new Set(['voice.use']);
  await expect(prepareReviewedAction(conversationId, reviewId)).rejects.toMatchObject({
    status: 403,
  });
  expect(mock.calls).toEqual([]);
  expect(mock.rpc).not.toHaveBeenCalled();
});
it('requires fresh daily record verification after an atomic confirmation; RPC success alone is insufficient', async () => {
  const prepared = await prepareReviewedAction(conversationId, reviewId);
  mock.rpc.mockResolvedValue({ data: prepared.day, error: null });
  const input = {
    id,
    conversationId,
    reviewId,
    title: 'My exact commitment',
    day: prepared.day,
    version: prepared.version,
    timezone: prepared.timezone,
    confirm: true,
  };
  await expect(confirmReviewedAction(input)).rejects.toMatchObject({ status: 503 });
  mock.rpc.mockImplementation(async () => {
    mock.receipt = { id, title: input.title, executed_day: input.day, status: 'executed' };
    mock.currentTitle = input.title;
    return { data: input.day, error: null };
  });
  expect((await confirmReviewedAction(input)).receipt).toMatchObject({
    id,
    title: input.title,
    verified: true,
  });
  expect(mock.rpc).toHaveBeenLastCalledWith(
    'ai_confirm_reviewed_daily_action',
    expect.objectContaining({ p_title: input.title, p_day: input.day, p_review: reviewId }),
  );
});
it('marks renamed or removed canonical daily actions as changed rather than claiming success', async () => {
  mock.receipt = {
    id,
    title: 'Original commitment',
    executed_day: '2026-10-12',
    status: 'executed',
  };
  mock.currentTitle = 'User edited the title';
  expect((await prepareReviewedAction(conversationId, reviewId)).receipt?.verified).toBe(false);
  mock.currentTitle = null;
  expect((await prepareReviewedAction(conversationId, reviewId)).receipt?.verified).toBe(false);
});
