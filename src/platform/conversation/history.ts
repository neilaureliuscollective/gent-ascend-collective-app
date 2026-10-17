import type { Turn } from '@/domains/intelligence/types';

/** Pagination identity for Talk older-history fetches. Never authorization. */
export type TalkHistoryRequest = {
  generation: number;
  ownerId: string;
  conversationId: string;
};

export type TalkHistoryScope = {
  generation: number;
  ownerId: string;
  conversationId: string | null;
};

export function shouldApplyOlderHistory(request: TalkHistoryRequest, current: TalkHistoryScope) {
  if (!request.conversationId || !current.conversationId) return false;
  if (request.generation !== current.generation) return false;
  if (request.conversationId !== current.conversationId) return false;
  if (request.ownerId && current.ownerId && request.ownerId !== current.ownerId) return false;
  return true;
}

export function shouldMergeOlderHistory(
  request: TalkHistoryRequest,
  current: TalkHistoryScope,
  previous: {
    ownerId?: string;
    currentConversation?: { id: string } | null;
    turns: Turn[];
  },
) {
  if (!shouldApplyOlderHistory(request, current)) return false;
  if (previous.ownerId && request.ownerId && previous.ownerId !== request.ownerId) return false;
  if (previous.currentConversation && previous.currentConversation.id !== request.conversationId)
    return false;
  if (previous.turns.some((turn) => turn.conversation_id !== request.conversationId)) return false;
  return true;
}

export function shouldClearOlderLoading(requestGeneration: number, currentGeneration: number) {
  return requestGeneration === currentGeneration;
}

export function olderTurnsBelongToConversation(
  turns: Turn[],
  conversationId: string,
  ownerId: string,
) {
  return turns.every(
    (turn) =>
      turn.conversation_id === conversationId &&
      (!ownerId || !turn.person_id || turn.person_id === ownerId),
  );
}

export function mergeOlderTurns(existing: Turn[], older: Turn[]) {
  const seen = new Set(existing.map((turn) => turn.id));
  return [...older.filter((turn) => !seen.has(turn.id)), ...existing];
}
