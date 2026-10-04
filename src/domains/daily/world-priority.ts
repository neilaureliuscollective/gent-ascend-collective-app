import 'server-only';
import { authorizedPerson } from '@/domains/access/authorize';
import { localDay } from './model';
import { DailyError } from './service';
import type { PersonalPriority, PriorityInput, PrioritySnapshot } from './world-priority-model';

type Context = NonNullable<Awaited<ReturnType<typeof authorizedPerson>>>;
async function loadDay({ person, client }: Context) {
  const day = localDay(new Date(), person.timezone);
  const { data, error } = await client
    .from('daily_entries')
    .select(
      'day,version,intention,energy,sleep_minutes,reflection,updated_at,actions:daily_actions(id,title,done,position)',
    )
    .eq('person_id', person.id)
    .eq('day', day)
    .maybeSingle();
  if (error) throw new DailyError('Your priority could not be loaded. Try again.', 503);
  return { day, entry: data };
}
function snapshot(
  context: Context,
  { day, entry }: Awaited<ReturnType<typeof loadDay>>,
): PersonalPriority {
  return {
    mode: 'personal',
    ownerId: context.person.id,
    day,
    timezone: context.person.timezone,
    version: entry?.version ?? 0,
    intention: entry?.intention ?? '',
    updatedAt: entry?.updated_at ?? null,
    nextAction:
      entry?.actions
        .slice()
        .sort((a, b) => a.position - b.position)
        .find((a) => !a.done)?.title ?? null,
  };
}
export async function readWorldPriority(): Promise<PrioritySnapshot> {
  const context = await authorizedPerson('daily.read');
  if (!context) return { mode: 'guest' };
  return snapshot(context, await loadDay(context));
}
export async function saveWorldPriority(input: PriorityInput): Promise<PersonalPriority> {
  const context = await authorizedPerson('daily.write');
  if (!context) throw new DailyError('Sign in again to save your priority.', 401);
  // The supplied owner is only a stale-session guard, never a lookup or authority.
  if (input.ownerId !== context.person.id)
    throw new DailyError('Your account changed. Reload before saving.', 409);
  const current = await loadDay(context);
  if (input.day !== current.day || input.version !== (current.entry?.version ?? 0))
    throw new DailyError('Your saved day changed. Reload it before saving your priority.', 409);
  const entry = current.entry;
  const actions = (entry?.actions ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map(({ id, title, done }) => ({ id, title, done }));
  // The first session explicitly reviews this addition. Never replace existing actions.
  if (
    input.nextAction &&
    !actions.some((action) => !action.done && action.title === input.nextAction)
  ) {
    if (actions.length >= 5)
      throw new DailyError(
        'Today already has five actions. Review your plan on Command before adding another.',
        409,
      );
    actions.push({ id: crypto.randomUUID(), title: input.nextAction, done: false });
  }
  const { error } = await context.client.rpc('daily_save', {
    p_day: input.day,
    p_version: input.version,
    p_intention: input.intention,
    p_energy: entry?.energy ?? null,
    p_sleep: entry?.sleep_minutes ?? null,
    p_reflection: entry?.reflection ?? '',
    p_actions: actions,
  });
  // The existing transaction also checks the version and local date under an owner lock.
  if (error?.code === '40001' || error?.code === '22023')
    throw new DailyError('Your saved day changed. Reload it before saving your priority.', 409);
  if (error)
    throw new DailyError(
      'The save could not be confirmed. Reload your saved priority before retrying.',
      503,
    );
  return snapshot(context, await loadDay(context));
}
