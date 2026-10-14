import 'server-only';
import {
  createTalkAuthorizedSourceAdapter,
  registerTalkSourceAdapter,
  type AuthorizedTalkSource,
} from '@/domains/architect-design-direction/talk-source';
import { IntelligenceError, intelligenceSession } from '@/domains/intelligence/service';
import type { DesignDirectionReceipt } from '@/domains/architect-design-direction/contract';
import { designBoardContentSchema, selectedDirection } from './design-board';
import { produceArchitectDirection, directionIdentity } from './architect-direction';

async function resolveTalkDesignSource(input: {
  personId: string;
  receipt: DesignDirectionReceipt;
}): Promise<AuthorizedTalkSource | null> {
  const { client, person } = await intelligenceSession();
  if (person.id !== input.personId) return null;
  const identity = input.receipt.identity;
  const row = await client
    .from('ai_talk_creations')
    .select('*')
    .eq('id', identity.boardId)
    .eq('person_id', person.id)
    .eq('conversation_id', identity.conversationId)
    .eq('kind', 'board')
    .maybeSingle();
  if (row.error) throw new IntelligenceError('Talk design board unavailable.', 503);
  if (!row.data || row.data.candidate || row.data.version !== identity.boardVersion) return null;
  const board = designBoardContentSchema.safeParse(row.data.content);
  if (!board.success) return null;
  const direction = selectedDirection(board.data);
  if (directionIdentity(row.data.id, direction.id) !== identity.directionId) return null;
  const authorized = produceArchitectDirection({
    conversationId: identity.conversationId,
    boardId: row.data.id,
    version: row.data.version,
    board: board.data,
  });
  return {
    kind: 'talk-authorized',
    digest: authorized.digest,
    receipt: authorized,
    note: 'Verified from owner-authorized immutable Talk board, version and selected direction.',
  };
}

registerTalkSourceAdapter(createTalkAuthorizedSourceAdapter(resolveTalkDesignSource));

export { resolveTalkDesignSource };
