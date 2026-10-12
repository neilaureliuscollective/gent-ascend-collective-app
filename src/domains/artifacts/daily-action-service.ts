import 'server-only';
import { intelligenceSession, IntelligenceError } from '@/domains/intelligence/service';
import { currentAccess } from '@/domains/access/current';
import { liveConfig } from '@/domains/live/config';
import { localDay } from '@/domains/daily/model';
import { reviewSchema } from './coworker';
import { reviewedAction, type ReviewedActionPreparation } from './daily-action';
async function actionSession() {
  liveConfig();
  const scope = await intelligenceSession();
  const access = await currentAccess();
  if (!access.has('voice.use') || !access.has('daily.write'))
    throw new IntelligenceError('Reviewed daily actions are not enabled for this account.', 403);
  return scope;
}
export async function prepareReviewedAction(
  conversationId: string,
  reviewId: string,
): Promise<ReviewedActionPreparation> {
  return readPreparation(await actionSession(), conversationId, reviewId);
}
async function readPreparation(
  scope: Awaited<ReturnType<typeof actionSession>>,
  conversationId: string,
  reviewId: string,
): Promise<ReviewedActionPreparation> {
  const { client, person } = scope;
  const conversation = await client
    .from('ai_conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('person_id', person.id)
    .is('company_id', null)
    .is('archived_at', null)
    .maybeSingle();
  if (conversation.error || !conversation.data)
    throw new IntelligenceError('Conversation unavailable.', 404);
  const source = await client
    .from('ai_conversation_artifacts')
    .select('visual')
    .eq('id', reviewId)
    .eq('person_id', person.id)
    .eq('conversation_id', conversationId)
    .eq('operation', 'visual.review')
    .eq('status', 'complete')
    .maybeSingle();
  const board = reviewSchema.safeParse(source.data?.visual);
  if (source.error || !board.success)
    throw new IntelligenceError('Completed review unavailable.', 404);
  const day = localDay(new Date(), person.timezone);
  const [entry, proposal, selection] = await Promise.all([
    client
      .from('daily_entries')
      .select('version')
      .eq('person_id', person.id)
      .eq('day', day)
      .maybeSingle(),
    client
      .from('ai_action_proposals')
      .select('id,title,executed_day,status')
      .eq('person_id', person.id)
      .eq('source_review_id', reviewId)
      .maybeSingle(),
    client
      .from('ai_artifact_selection')
      .select('artifact_id')
      .eq('person_id', person.id)
      .eq('conversation_id', conversationId)
      .maybeSingle(),
  ]);
  if (entry.error || proposal.error || selection.error)
    throw new IntelligenceError('Saved action status unavailable.', 503);
  let receipt: ReviewedActionPreparation['receipt'] = null;
  if (proposal.data) {
    const saved = proposal.data;
    if (saved.status !== 'executed' || !saved.executed_day)
      throw new IntelligenceError('Action status could not be verified.', 503);
    const action = await client
      .from('daily_actions')
      .select('id,title')
      .eq('person_id', person.id)
      .eq('day', saved.executed_day)
      .eq('id', saved.id)
      .maybeSingle();
    if (action.error) throw new IntelligenceError('Action receipt could not be verified.', 503);
    receipt = {
      id: saved.id,
      title: saved.title,
      day: saved.executed_day,
      verified: action.data?.title === saved.title,
    };
  } else if (selection.data?.artifact_id !== reviewId) {
    throw new IntelligenceError('Select this review before preparing an action.', 409);
  }
  return {
    conversationId,
    reviewId,
    sourceTitle: board.data.title,
    day,
    timezone: person.timezone,
    version: entry.data?.version ?? 0,
    receipt,
  };
}
export async function confirmReviewedAction(body: unknown) {
  const input = reviewedAction.safeParse(body);
  if (!input.success) throw new IntelligenceError('Review the exact action title and day.');
  const scope = await actionSession();
  // Validate the persisted review schema, not a caller-provided AI suggestion.
  await readPreparation(scope, input.data.conversationId, input.data.reviewId);
  const value = input.data;
  const result = await scope.client.rpc('ai_confirm_reviewed_daily_action', {
    p_id: value.id,
    p_conversation: value.conversationId,
    p_review: value.reviewId,
    p_title: value.title,
    p_day: value.day,
    p_version: value.version,
    p_timezone: value.timezone,
  });
  if (result.error) {
    if (result.error.code === '42501')
      throw new IntelligenceError('This action is not authorized.', 403);
    if (['40001', '22023', 'P0001', '23505'].includes(result.error.code))
      throw new IntelligenceError(
        'The review, daily record or local day changed, or today already has five actions. Reload saved status before preparing again.',
        409,
      );
    throw new IntelligenceError(
      'The action save is unconfirmed. Check saved status before continuing.',
      503,
    );
  }
  const verified = await readPreparation(scope, value.conversationId, value.reviewId);
  if (
    !verified.receipt?.verified ||
    verified.receipt.id !== value.id ||
    verified.receipt.title !== value.title ||
    verified.receipt.day !== value.day
  )
    throw new IntelligenceError(
      'The action receipt is unconfirmed. Check saved status before continuing.',
      503,
    );
  return verified;
}
