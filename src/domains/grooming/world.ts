import 'server-only';
import { authorizedPerson } from '@/domains/access/authorize';
import { localDay } from '@/domains/daily/model';
import { GroomingError } from './service';
import { suggestedRitualKind } from './ritual-model';
import type { GroomingWorldSnapshot, PracticeInput, PracticeReceipt } from './world-model';
export async function readGroomingWorld(): Promise<GroomingWorldSnapshot> {
  const context = await authorizedPerson('profile.read');
  if (!context) return { mode: 'guest' };
  const { person, client } = context;
  const now = new Date(),
    day = localDay(now, person.timezone);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(`${day}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - 6 + i);
    return date.toISOString().slice(0, 10);
  });
  const [result, history] = await Promise.all([
    client
      .from('grooming_rituals')
      .select('id,kind,title,steps,version')
      .eq('person_id', person.id)
      .eq('active', true)
      .order('kind')
      .limit(3),
    client
      .from('grooming_checkins')
      .select('ritual_id,occurred_at,note,local_day')
      .eq('person_id', person.id)
      .eq('done', true)
      .gte(
        'occurred_at',
        new Date(new Date(`${days[0]}T00:00:00Z`).getTime() - 26 * 3600000).toISOString(),
      )
      .order('occurred_at', { ascending: false })
      .limit(100),
  ]);
  if (result.error || history.error)
    throw new GroomingError('Your rituals are temporarily unavailable.', 503);
  const rituals = await Promise.all(
    (result.data ?? []).map(async (ritual) => {
      const [last, products] = await Promise.all([
        client
          .from('grooming_checkins')
          .select('occurred_at')
          .eq('person_id', person.id)
          .eq('ritual_id', ritual.id)
          .eq('done', true)
          .order('occurred_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        client
          .from('grooming_products')
          .select('id,name,relation,note', { count: 'exact' })
          .eq('person_id', person.id)
          .eq('ritual_id', ritual.id)
          .order('created_at', { ascending: false })
          .limit(12),
      ]);
      if (last.error || products.error)
        throw new GroomingError('Your practice history is temporarily unavailable.', 503);
      return {
        ...ritual,
        lastRecordedAt: last.data?.occurred_at ?? null,
        products: products.data ?? [],
        productCount: products.count ?? 0,
      };
    }),
  );
  return {
    mode: 'personal',
    ownerId: person.id,
    day,
    timezone: person.timezone,
    rituals,
    suggestedKind: suggestedRitualKind(now, person.timezone),
    week: days.map((date) => {
      const entries = (history.data ?? []).filter(
        (item) =>
          (item.local_day ?? localDay(new Date(item.occurred_at), person.timezone)) === date,
      );
      return {
        day: date,
        completed: new Set(entries.map((item) => item.ritual_id)).size,
        notes: entries
          .map((item) => item.note)
          .filter(Boolean)
          .slice(0, 3),
      };
    }),
  };
}
export async function recordWorldPractice(input: PracticeInput): Promise<PracticeReceipt> {
  const context = await authorizedPerson('profile.write');
  if (!context) throw new GroomingError('Sign in to record your practice.', 401);
  const { person, client } = context;
  if (person.id !== input.ownerId)
    throw new GroomingError('Your account changed. Reopen your Grooming world.', 409);
  const result = await client.rpc('grooming_record_practice', {
    p_request: input.requestId,
    p_ritual: input.ritualId,
    p_version: input.version,
    p_day: input.day,
    p_note: '',
  });
  if (result.error)
    throw new GroomingError(
      result.error.code === '40001'
        ? 'Your ritual or local day changed. Reopen Grooming before recording.'
        : 'The save could not be confirmed. Retry to confirm this same practice.',
      result.error.code === '40001' ? 409 : 503,
    );
  const receipt = result.data as { id: string; ritualId: string; occurredAt: string } | null;
  if (!receipt)
    throw new GroomingError(
      'The save could not be confirmed. Retry to confirm this same practice.',
      503,
    );
  return { ...receipt, requestId: input.requestId };
}
