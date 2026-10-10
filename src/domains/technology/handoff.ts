import 'server-only';
import { intelligenceSession, IntelligenceError } from '@/domains/intelligence/service';

// Explicit source selection, never a global transcript search or inferred active project.
export async function readWebsiteHandoff(projectId: string, turnId: string, expected?: number) {
  const { client, person } = await intelligenceSession();
  const project = await client
    .from('technology_projects')
    .select('*')
    .eq('person_id', person.id)
    .eq('id', projectId)
    .maybeSingle();
  if (
    project.error ||
    !project.data?.mission_id ||
    (expected !== undefined && project.data.revision !== expected)
  )
    throw new IntelligenceError('Website project or revision unavailable.', 409);
  const mission = await client
    .from('intelligence_missions')
    .select('conversation_id')
    .eq('person_id', person.id)
    .eq('id', project.data.mission_id)
    .maybeSingle();
  if (mission.error || !mission.data)
    throw new IntelligenceError('Source Mission unavailable.', 404);
  const turn = await client
    .from('ai_turns')
    .select('id,user_text,status')
    .eq('person_id', person.id)
    .eq('conversation_id', mission.data.conversation_id)
    .eq('id', turnId)
    .maybeSingle();
  if (
    turn.error ||
    !turn.data ||
    turn.data.status !== 'complete' ||
    turn.data.user_text.trim().length < 3 ||
    turn.data.user_text.trim().length > 1000
  )
    throw new IntelligenceError(
      'Choose a completed request of 3–1000 characters from this Mission.',
      409,
    );
  return { instruction: turn.data.user_text.trim(), revision: project.data.revision, turnId };
}
