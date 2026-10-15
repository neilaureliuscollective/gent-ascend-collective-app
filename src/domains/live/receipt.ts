export type VoiceTurnBinding = {
  providerItemId: string;
  providerResponseId: string | null;
  turnId: string;
};

export type VoicePersistenceReceipt = {
  ownerId: string;
  conversationId: string;
  sessionId: string;
  bindings: VoiceTurnBinding[];
  turns: Array<{ id: string; user_text: string; created_at: string }>;
};

export type VoiceReconcileIdentity = {
  ownerId: string;
  conversationId: string;
  sessionId: string;
  epoch: number;
};

export function voiceItemsAcknowledged(
  expectedItemIds: string[],
  bindings: VoiceTurnBinding[],
) {
  if (!expectedItemIds.length) return true;
  const saved = new Set(bindings.map((item) => item.providerItemId));
  return expectedItemIds.every((id) => saved.has(id));
}

export function matchesVoiceReconcile(
  current: VoiceReconcileIdentity | null | undefined,
  expected: VoiceReconcileIdentity,
) {
  return Boolean(
    current &&
      current.ownerId === expected.ownerId &&
      current.conversationId === expected.conversationId &&
      current.sessionId === expected.sessionId &&
      current.epoch === expected.epoch,
  );
}

export function voiceWorkspaceApplyAllowed(
  current: VoiceReconcileIdentity | null | undefined,
  expected: VoiceReconcileIdentity,
  selected: string | null | undefined,
  nextOwnerId: string | null | undefined,
) {
  return (
    matchesVoiceReconcile(current, expected) &&
    Boolean(selected) &&
    selected === expected.conversationId &&
    Boolean(nextOwnerId) &&
    nextOwnerId === expected.ownerId
  );
}
