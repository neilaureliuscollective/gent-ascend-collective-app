import 'server-only';
import { authorizedPerson } from '@/domains/access/authorize';
import { localDay } from '@/domains/daily/model';
import { GroomingError } from './service';
import type { GroomingWorldSnapshot, PracticeInput, PracticeReceipt } from './world-model';

export async function readGroomingWorld(): Promise<GroomingWorldSnapshot> {
  const context = await authorizedPerson('profile.read');
  if (!context) return { mode: 'guest' };
  const { person, client } = context;
  const result = await client
    .from('grooming_rituals')
    .select('id,kind,title,steps,version')
    .eq('person_id', person.id)
    .eq('active', true)
    .order('kind')
    .limit(3);
  if (result.error) throw new GroomingError('Your rituals are temporarily unavailable.', 503);
  const rituals = await Promise.all(
    (result.data ?? []).map(async (ritual) => {
      const last = await client
        .from('grooming_checkins')
        .select('occurred_at')
        .eq('person_id', person.id)
        .eq('ritual_id', ritual.id)
        .eq('done', true)
        .order('occurred_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (last.error)
        throw new GroomingError('Your practice history is temporarily unavailable.', 503);
      return { ...ritual, lastRecordedAt: last.data?.occurred_at ?? null };
    }),
  );
  return {
    mode: 'personal',
    ownerId: person.id,
    day: localDay(new Date(), person.timezone),
    timezone: person.timezone,
    rituals,
  };
}
export async function recordWorldPractice(input: PracticeInput): Promise<PracticeReceipt> {
  const context = await authorizedPerson('profile.write');
  if (!context) throw new GroomingError('Sign in to record your practice.', 401);
  const { person, client } = context;
  if (person.id !== input.ownerId)
    throw new GroomingError('Your account changed. Reopen your Grooming world.', 409);
  const existing = async () => {
    const result = await client
      .from('grooming_checkins')
      .select('id,ritual_id,done,note,occurred_at')
      .eq('person_id', person.id)
      .eq('id', input.requestId)
      .maybeSingle();
    if (result.error)
      throw new GroomingError('The record could not be checked. Retry to confirm it.', 503);
    if (!result.data) return null;
    if (result.data.ritual_id !== input.ritualId || !result.data.done || result.data.note !== '')
      throw new GroomingError('This recording request has already been used.', 409);
    return {
      id: result.data.id,
      ritualId: result.data.ritual_id,
      occurredAt: result.data.occurred_at,
    };
  };
  // Retry the same immutable record ID after an uncertain response, including across midnight.
  const previous = await existing();
  if (previous) return previous;
  if (input.day !== localDay(new Date(), person.timezone))
    throw new GroomingError('The local day changed. Reopen your Grooming world.', 409);
  const ritual = await client
    .from('grooming_rituals')
    .select('id')
    .eq('person_id', person.id)
    .eq('id', input.ritualId)
    .eq('active', true)
    .maybeSingle();
  if (ritual.error) throw new GroomingError('Your ritual could not be checked. Try again.', 503);
  if (!ritual.data)
    throw new GroomingError('This ritual changed. Reopen your Grooming world.', 409);
  const saved = await client
    .from('grooming_checkins')
    .insert({
      id: input.requestId,
      person_id: person.id,
      ritual_id: input.ritualId,
      done: true,
      note: '',
    })
    .select('id,ritual_id,occurred_at')
    .single();
  if (saved.error?.code === '23505') {
    const receipt = await existing();
    if (receipt) return receipt;
  }
  if (saved.error || !saved.data)
    throw new GroomingError(
      'The save could not be confirmed. Retry to confirm this same practice.',
      503,
    );
  return { id: saved.data.id, ritualId: saved.data.ritual_id, occurredAt: saved.data.occurred_at };
}
