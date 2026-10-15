import 'server-only';
import { IntelligenceError, intelligenceSession } from '@/domains/intelligence/service';
import { currentAccess } from '@/domains/access/current';
import { readTalkCreations } from '@/domains/talk-creation/service';
import {
  resolveWorkTarget,
  spokenWorkTargetUpdate,
  talkDocumentFields,
  type WorkTarget,
} from '@/domains/work-items';

export async function verifySpokenWorkTarget(input: {
  sessionId: string;
  workTarget: WorkTarget | null;
}) {
  const { client, person } = await intelligenceSession();
  if (!(await currentAccess()).has('voice.use'))
    throw new IntelligenceError('Voice access unavailable.', 403);
  const session = await client
    .from('ai_live_sessions')
    .select('id,conversation_id,ended_at,expires_at')
    .eq('id', input.sessionId)
    .eq('person_id', person.id)
    .maybeSingle();
  if (session.error || !session.data || session.data.ended_at)
    throw new IntelligenceError('This voice session is not current.', 409);
  if (!session.data.conversation_id || new Date(session.data.expires_at).getTime() <= Date.now())
    throw new IntelligenceError('This voice session is not current.', 409);
  const workspace = await readTalkCreations(session.data.conversation_id);
  const resolved = resolveWorkTarget(
    workspace,
    input.workTarget,
    null,
    session.data.conversation_id,
  );
  if (resolved.status === 'active' && resolved.target && resolved.item) {
    const creation = workspace.creations.find((item) => item.id === resolved.target!.creationId);
    const fields = creation ? talkDocumentFields(resolved.item.kind, creation.content) : [];
    if (!fields.some((field) => field.id === resolved.target!.field)) {
      return spokenWorkTargetUpdate({
        status: 'stale',
        target: null,
        item: null,
        reason: 'That selection is no longer current. Choose the field again before changing it.',
      });
    }
  }
  return spokenWorkTargetUpdate(resolved);
}
