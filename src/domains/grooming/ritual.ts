import 'server-only';
import { groomingOwner, GroomingError } from './service';
import { ritualDraftInput, ritualFeedbackInput, parseRitualSuggestion } from './ritual-model';
export async function saveReviewedRitual(raw: unknown) {
  const parsed=ritualDraftInput.safeParse(raw);
  if(!parsed.success)throw new GroomingError('Review a valid ritual name and steps.',400);
  const input = parsed.data,
    { client, person } = await groomingOwner(true);
  if (input.ownerId !== person.id)
    throw new GroomingError('Your account changed. Reopen Grooming.', 409);
  const result = await client.rpc('grooming_review_ritual', {
    p_request: input.requestId,
    p_kind: input.kind,
    p_version: input.expectedVersion,
    p_title: input.title,
    p_steps: input.steps,
    p_source: input.sourceTurnId,
  });
  if (result.error)
    throw new GroomingError(
      result.error.code === '40001'
        ? 'This ritual changed elsewhere. Reload before reviewing your draft.'
        : 'The save could not be confirmed. Retry this same draft.',
      result.error.code === '40001' ? 409 : 503,
    );
  return { id: result.data, requestId: input.requestId };
}
export async function savePracticeFeedback(raw: unknown) {
  const parsed=ritualFeedbackInput.safeParse(raw);
  if(!parsed.success)throw new GroomingError('Choose a valid feedback option.',400);
  const input = parsed.data,
    { client, person } = await groomingOwner(true);
  if (input.ownerId !== person.id)
    throw new GroomingError('Your account changed. Reopen Grooming.', 409);
  const result = await client.rpc('grooming_practice_feedback', {
    p_checkin: input.checkinId,
    p_note: input.note,
  });
  if (result.error || !result.data)
    throw new GroomingError(
      'Feedback could not be confirmed. Retry the same choice or reopen Grooming.',
      result.error?.code === '40001' ? 409 : 503,
    );
  return { saved: true };
}

export async function readRitualSuggestion(source: string) {
  const { client, person } = await groomingOwner();
  const { data, error } = await client
    .from('ai_turns')
    .select('assistant_text,status')
    .eq('person_id', person.id)
    .eq('id', source)
    .maybeSingle();
  if (error || !data || data.status !== 'complete')
    throw new GroomingError('This saved suggestion is unavailable.', 404);
  const proposal = parseRitualSuggestion(data.assistant_text);
  if (!proposal)
    throw new GroomingError('This reply does not contain a complete ritual suggestion.', 400);
  return { ...proposal, sourceTurnId: source };
}
