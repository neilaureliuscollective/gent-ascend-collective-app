import 'server-only';
import { intelligenceSession, IntelligenceError } from '@/domains/intelligence/service';
import { parseWebsiteProposal, planningVersion } from './planning';

export async function readWebsiteProposal(missionId: string, turnId: string) {
  const { client, person } = await intelligenceSession();
  const mission = await client
    .from('intelligence_missions')
    .select('id,conversation_id,revision,status')
    .eq('person_id', person.id)
    .eq('id', missionId)
    .maybeSingle();
  if (mission.error || !mission.data || ['archived', 'completed'].includes(mission.data.status))
    throw new IntelligenceError('Active source Mission unavailable.', 409);
  const turn = await client
    .from('ai_turns')
    .select('assistant_text,status,prompt_version')
    .eq('person_id', person.id)
    .eq('conversation_id', mission.data.conversation_id)
    .eq('id', turnId)
    .maybeSingle();
  const brief =
    turn.data?.status === 'complete' && turn.data.prompt_version.endsWith(`:${planningVersion}`)
      ? parseWebsiteProposal(turn.data.assistant_text)
      : null;
  if (turn.error || !brief)
    throw new IntelligenceError('Completed website proposal unavailable.', 409);
  return { brief, turnId, missionId, missionRevision: mission.data.revision };
}
