import 'server-only';
import { intelligenceSession, IntelligenceError } from '@/domains/intelligence/service';
import { councilFromVersion } from '@/domains/intelligence/council';
import type { createMissionInput, updateMissionInput } from './schema';
import type { z } from 'zod';
export async function readMissions(conversationId?: string) {
  const { client, person } = await intelligenceSession();
  let query = client.from('intelligence_missions').select('*').eq('person_id', person.id);
  if (conversationId) query = query.eq('conversation_id', conversationId);
  const result = await query.order('updated_at', { ascending: false }).limit(100);
  if (result.error)
    throw new IntelligenceError('Missions are unavailable. Your conversations remain saved.', 503);
  return result.data ?? [];
}
export async function createMission(input: z.infer<typeof createMissionInput>) {
  const { client, person } = await intelligenceSession();
  const conversation = await client
    .from('ai_conversations')
    .select('id,archived_at')
    .eq('person_id', person.id)
    .eq('id', input.conversation_id)
    .is('company_id', null)
    .maybeSingle();
  if (conversation.error) throw new IntelligenceError('Conversation scope unavailable.', 503);
  if (!conversation.data || conversation.data.archived_at)
    throw new IntelligenceError('Use an active conversation in your personal workspace.', 404);
  // Recover an ambiguous create without overwriting a subsequent user edit.
  const previous = await client
    .from('intelligence_missions')
    .select('*')
    .eq('person_id', person.id)
    .eq('conversation_id', input.conversation_id)
    .maybeSingle();
  if (previous.error) throw new IntelligenceError('Mission receipt unavailable.', 503);
  if (previous.data) {
    if (previous.data.id !== input.id)
      throw new IntelligenceError(
        'This conversation already has a Mission. Open Missions to resume it.',
        409,
      );
    return previous.data;
  }
  const count = await client
    .from('intelligence_missions')
    .select('id', { count: 'exact', head: true })
    .eq('person_id', person.id);
  if (count.error || count.count === null)
    throw new IntelligenceError('Mission allowance unavailable.', 503);
  if (count.count >= 100)
    throw new IntelligenceError('Your workspace currently supports 100 Missions.', 429);
  const result = await client
    .from('intelligence_missions')
    .insert({ ...input, person_id: person.id })
    .select('*')
    .single();
  if (result.error || !result.data)
    throw new IntelligenceError(
      'Mission save was not confirmed. Reload Missions before retrying.',
      409,
    );
  return result.data;
}
export async function updateMission(input: z.infer<typeof updateMissionInput>) {
  const { client, person } = await intelligenceSession();
  const { id, expected_revision, ...fields } = input;
  const result = await client
    .from('intelligence_missions')
    .update({ ...fields, revision: expected_revision + 1, updated_at: new Date().toISOString() })
    .eq('person_id', person.id)
    .eq('id', id)
    .eq('revision', expected_revision)
    .select('*')
    .maybeSingle();
  if (result.error || !result.data)
    throw new IntelligenceError(
      'Mission changed or the save was not confirmed. Reload before editing again.',
      409,
    );
  return result.data;
}
export async function missionParticipants(conversationId: string) {
  const { client, person } = await intelligenceSession();
  const result = await client
    .from('ai_turns')
    .select('prompt_version,status')
    .eq('person_id', person.id)
    .eq('conversation_id', conversationId)
    .eq('status', 'complete')
    .limit(500);
  if (result.error) throw new IntelligenceError('Participant receipts unavailable.', 503);
  return [
    ...new Set(
      (result.data ?? []).flatMap(
        (turn) => councilFromVersion(turn.prompt_version ?? '')?.specialists ?? [],
      ),
    ),
  ];
}
