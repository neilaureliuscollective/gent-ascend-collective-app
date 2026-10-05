import 'server-only';
import { authorizedPerson } from '@/domains/access/authorize';
import { readDaily } from '@/domains/daily/service';
import { daysEnding, localDay, type DailyData } from '@/domains/daily/model';
import { projectContinuity } from './model';
/** Request-only, session-bound reads. Errors are unknown, never reported as zero. */
export async function readContinuity(
  owner?: Awaited<ReturnType<typeof authorizedPerson>>,
  savedDaily?: DailyData,
) {
  const context = owner === undefined ? await authorizedPerson('daily.read') : owner;
  if (!context) return null;
  const { person, client } = context;
  const today = localDay(new Date(), person.timezone);
  if (
    savedDaily &&
    (savedDaily.mode !== 'personal' ||
      savedDaily.ownerId !== person.id ||
      savedDaily.today !== today ||
      savedDaily.timezone !== person.timezone)
  )
    throw new Error('Daily account or date changed');
  // Extra UTC day on either end covers every member calendar timezone; projection filters exactly.
  const since = daysEnding(today, 8)[0]!;
  const queries = await Promise.allSettled([
    savedDaily ? Promise.resolve(savedDaily) : readDaily(context),
    client
      .from('performance_sessions')
      .select('id,title,status,started_at,ended_at')
      .eq('person_id', person.id)
      .in('status', ['active', 'complete'])
      .or(`status.eq.active,ended_at.gte.${since}T00:00:00Z`)
      .order('started_at', { ascending: false })
      .limit(100),
    client
      .from('grooming_rituals')
      .select('id,title,kind')
      .eq('person_id', person.id)
      .eq('active', true)
      .limit(3),
    client
      .from('grooming_checkins')
      .select('ritual_id,done,occurred_at')
      .eq('person_id', person.id)
      .gte('occurred_at', `${since}T00:00:00Z`)
      .order('occurred_at', { ascending: false })
      .limit(500),
  ]);
  const [daily, sessions, rituals, checkins] = queries;
  if (daily.status !== 'fulfilled') throw new Error('Daily continuity unavailable');
  // A capped result may be incomplete: preserve unknown instead of undercounting.
  return projectContinuity(daily.value, {
    sessions:
      sessions.status === 'fulfilled' &&
      !sessions.value.error &&
      (sessions.value.data?.length ?? 0) < 100
        ? (sessions.value.data ?? [])
        : null,
    rituals:
      rituals.status === 'fulfilled' && !rituals.value.error ? (rituals.value.data ?? []) : null,
    checkins:
      checkins.status === 'fulfilled' &&
      !checkins.value.error &&
      (checkins.value.data?.length ?? 0) < 500
        ? (checkins.value.data ?? [])
        : null,
  });
}
