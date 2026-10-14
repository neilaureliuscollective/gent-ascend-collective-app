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
