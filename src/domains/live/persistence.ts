import { IntelligenceError, intelligenceSession } from '@/domains/intelligence/service';
import { voiceItemsAcknowledged, type VoicePersistenceReceipt, type VoiceTurnBinding } from './receipt';

export type { VoicePersistenceReceipt, VoiceTurnBinding };
export { voiceItemsAcknowledged };

export async function readVoicePersistence(
  conversationId: string,
  sessionId: string,
): Promise<VoicePersistenceReceipt> {
  const { client, person } = await intelligenceSession();
  const conversation = await client
    .from('ai_conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('person_id', person.id)
    .is('company_id', null)
    .maybeSingle();
  if (conversation.error || !conversation.data)
    throw new IntelligenceError('Conversation unavailable.', 404);
  const [bindings, turns] = await Promise.all([
    client.rpc('ai_live_read_bindings', {
      p_session: sessionId,
      p_conversation: conversationId,
    }),
    client
      .from('ai_turns')
      .select('id,user_text,created_at')
      .eq('person_id', person.id)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(80),
  ]);
  if (bindings.error || turns.error)
    throw new IntelligenceError('Voice save receipt unavailable.', 503);
  return {
    ownerId: person.id,
    conversationId,
    sessionId,
    bindings: Array.isArray(bindings.data) ? (bindings.data as VoiceTurnBinding[]) : [],
    turns: turns.data ?? [],
  };
}
