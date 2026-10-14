/** Conversation/owner fence for Talk creation fetches and image watches. Never authorization. */
export type CreationScope = {
  owner: string;
  conversation: string | null;
};

export function idleCreationScope(owner = ''): CreationScope {
  return { owner, conversation: null };
}

export function shouldApplyCreation(
  scope: CreationScope,
  owner: string,
  conversation: string | null,
) {
  if (scope.conversation !== conversation) return false;
  if (scope.owner && owner && scope.owner !== owner) return false;
  return true;
}

export function shouldContinueWatch(
  currentGeneration: number,
  generation: number,
  scope: CreationScope,
  owner: string,
  conversation: string,
) {
  return (
    currentGeneration === generation && shouldApplyCreation(scope, owner, conversation)
  );
}

/** Null/new conversation is never permission to recover another conversation. */
export function shouldRecoverPending(
  scope: CreationScope,
  owner: string,
  conversation: string,
  currentGeneration?: number,
  generation?: number,
) {
  if (!owner || !conversation) return false;
  if (currentGeneration !== undefined && generation !== undefined && currentGeneration !== generation)
    return false;
  if (scope.conversation !== conversation) return false;
  if (scope.owner && scope.owner !== owner) return false;
  return true;
}
