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

export function voiceItemsAcknowledged(
  expectedItemIds: string[],
  bindings: VoiceTurnBinding[],
) {
  if (!expectedItemIds.length) return true;
  const saved = new Set(bindings.map((item) => item.providerItemId));
  return expectedItemIds.every((id) => saved.has(id));
}
