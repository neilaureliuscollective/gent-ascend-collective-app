import 'server-only';
import { authorizedPerson } from '@/domains/access/authorize';
import { localDay } from '@/domains/daily/model';
import type { PresenceData } from './model';

export async function readPresence(): Promise<PresenceData> {
  const owner = await authorizedPerson('profile.read');
  if (!owner)
    return {
      mode: 'signed-out',
      ownerId: undefined,
      today: '',
      direction: null,
      occasions: [],
      replenishment: [],
      unavailable: [],
    };
  const { client, person } = owner;
  const today = localDay(new Date(), person.timezone);
  const results = await Promise.allSettled([
    client
      .from('grooming_profiles')
      .select('preferred_look')
      .eq('person_id', person.id)
      .maybeSingle(),
    client
      .from('grooming_events')
      .select('title,event_date,note')
      .eq('person_id', person.id)
      .gte('event_date', today)
      .order('event_date')
      .limit(6),
    client
      .from('grooming_products')
      .select('name,note')
      .eq('person_id', person.id)
      .eq('relation', 'running_low')
      .order('created_at', { ascending: false })
      .limit(6),
  ] as const);
  const unavailable: string[] = [];
  function value<T extends { error: unknown; data: unknown }>(
    result: PromiseSettledResult<T>,
    label: string,
  ): T['data'] | null {
    if (result.status === 'rejected' || result.value.error) {
      unavailable.push(label);
      return null;
    }
    return result.value.data;
  }
  const profile = value(results[0], 'Appearance direction');
  const occasions = value(results[1], 'Occasions');
  const products = value(results[2], 'Product notes');
  return {
    mode: 'personal',
    ownerId: person.id,
    today,
    direction: profile?.preferred_look || null,
    occasions: (occasions ?? []).map((event) => ({
      title: event.title,
      day: event.event_date,
      note: event.note,
    })),
    replenishment: products ?? [],
    unavailable,
  };
}
