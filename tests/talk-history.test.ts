import { describe, expect, it } from 'vitest';
import type { Turn } from '@/domains/intelligence/types';
import {
  mergeOlderTurns,
  olderTurnsBelongToConversation,
  shouldApplyOlderHistory,
  shouldClearOlderLoading,
  shouldMergeOlderHistory,
} from '@/platform/conversation/history';

const owner = '60000000-0000-4000-8000-000000000001';
const conversationA = '30000000-0000-4000-8000-000000000001';
const conversationB = '30000000-0000-4000-8000-000000000002';

function turn(id: string, conversation: string, created = '2026-10-16T10:00:00.000Z'): Turn {
  return {
    id,
    person_id: owner,
    conversation_id: conversation,
    user_text: `${conversation} ${id}`,
    assistant_text: 'saved',
    status: 'complete',
    model: 'synthetic',
    context_included: false,
    prompt_version: 'fixture',
    feedback: null,
    created_at: created,
    finished_at: created,
  };
}

describe('Talk older-history isolation', () => {
  it('ignores a delayed conversation A completion after switching to B or New', () => {
    const request = { generation: 1, ownerId: owner, conversationId: conversationA };
    expect(
      shouldApplyOlderHistory(request, {
        generation: 2,
        ownerId: owner,
        conversationId: conversationB,
      }),
    ).toBe(false);
    expect(
      shouldApplyOlderHistory(request, { generation: 2, ownerId: owner, conversationId: null }),
    ).toBe(false);
    expect(
      shouldApplyOlderHistory(request, {
        generation: 1,
        ownerId: owner,
        conversationId: conversationA,
      }),
    ).toBe(true);
  });

  it('ignores owner changes and does not clear a newer request’s loading state', () => {
    expect(
      shouldApplyOlderHistory(
        { generation: 4, ownerId: owner, conversationId: conversationA },
        { generation: 4, ownerId: 'other-owner', conversationId: conversationA },
      ),
    ).toBe(false);
    expect(shouldClearOlderLoading(4, 5)).toBe(false);
    expect(shouldClearOlderLoading(5, 5)).toBe(true);
  });

  it('keeps A → B → A from applying the first A completion', () => {
    const firstA = { generation: 1, ownerId: owner, conversationId: conversationA };
    const backOnA = { generation: 3, ownerId: owner, conversationId: conversationA };
    expect(shouldApplyOlderHistory(firstA, backOnA)).toBe(false);
    expect(
      shouldApplyOlderHistory(
        { generation: 3, ownerId: owner, conversationId: conversationA },
        backOnA,
      ),
    ).toBe(true);
  });

  it('rejects turns that belong to another conversation and prepends without duplicates', () => {
    const current = [turn('new-1', conversationA, '2026-10-16T12:00:00.000Z')];
    const older = [
      turn('old-1', conversationA, '2026-10-16T09:00:00.000Z'),
      turn('new-1', conversationA, '2026-10-16T12:00:00.000Z'),
    ];
    expect(olderTurnsBelongToConversation(older, conversationA, owner)).toBe(true);
    expect(
      olderTurnsBelongToConversation([turn('old-1', conversationB)], conversationA, owner),
    ).toBe(false);
    expect(mergeOlderTurns(current, older).map((item) => item.id)).toEqual(['old-1', 'new-1']);
    expect(
      shouldMergeOlderHistory(
        { generation: 1, ownerId: owner, conversationId: conversationA },
        { generation: 1, ownerId: owner, conversationId: conversationA },
        {
          ownerId: owner,
          currentConversation: { id: conversationB },
          turns: [turn('b', conversationB)],
        },
      ),
    ).toBe(false);
    expect(
      shouldMergeOlderHistory(
        { generation: 1, ownerId: owner, conversationId: conversationA },
        { generation: 1, ownerId: owner, conversationId: null },
        { ownerId: owner, currentConversation: null, turns: [] },
      ),
    ).toBe(false);
  });
});
