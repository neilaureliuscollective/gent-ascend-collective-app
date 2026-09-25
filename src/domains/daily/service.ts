import 'server-only';
import { authorizedPerson } from '@/domains/access/authorize';
import { daysEnding, localDay, type DailyData, type DayInput } from './model';
export class DailyError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function readDaily(): Promise<DailyData> {
  const context = await authorizedPerson('daily.read');
  if (!context)
    return {
      mode: 'preview',
      name: null,
      today: localDay(new Date(), 'UTC'),
      timezone: 'UTC',
      entries: [],
      goal: null,
      conversation: null,
    };
  const { person, client } = context;
  const today = localDay(new Date(), person.timezone);
  const since = daysEnding(today, 30)[0]!;
  const [entries, goals, conversations, captures, direction] = await Promise.all([
    client
      .from('daily_entries')
      .select(
        'day,timezone,energy,sleep_minutes,intention,reflection,version,updated_at,actions:daily_actions(id,title,done,position)',
      )
      .eq('person_id', person.id)
      .gte('day', since)
      .lte('day', today)
      .order('day'),
    client
      .from('goals')
      .select('title,next_step')
      .eq('person_id', person.id)
      .eq('status', 'active')
      .limit(1),
    client
      .from('ai_conversations')
      .select('id,title')
      .eq('person_id', person.id)
      .order('updated_at', { ascending: false })
      .limit(1),
    client.from('life_captures').select('id', { count: 'exact', head: true }).eq('person_id', person.id).eq('status', 'inbox'),
    client.from('ascend_profile_facts').select('value').eq('person_id',person.id).eq('fact_key','direction').maybeSingle(),
  ]);
  if (entries.error || goals.error || conversations.error || captures.error || direction.error)
    throw new DailyError('Your daily records could not be loaded. Please try again.', 503);
  const previous = [...(entries.data ?? [])].reverse().find((entry) => entry.day < today && (entry.reflection || entry.actions.some((action) => !action.done)));
  return {
    mode: 'personal',
    name: person.display_name,
    today,
    timezone: person.timezone,
    entries: (entries.data ?? []).map((entry) => ({
      ...entry,
      actions: entry.actions
        .sort((a, b) => a.position - b.position)
        .map(({ id, title, done }) => ({ id, title, done })),
    })),
    goal: goals.data?.[0] ?? null,
    conversation: conversations.data?.[0] ?? null,
    openCaptures: captures.count ?? 0,
    profileDirection: direction.data?.value ?? null,
    carryForward: previous ? { day: previous.day, reflection: previous.reflection, unfinished: previous.actions.filter((action) => !action.done).map((action) => action.title) } : null,
  };
}
export async function saveDaily(input: DayInput): Promise<DailyData> {
  const context = await authorizedPerson('daily.write');
  if (!context) throw new DailyError('Sign in to save your day.', 401);
  const { error } = await context.client.rpc('daily_save', {
    p_day: input.day,
    p_version: input.version,
    p_energy: input.energy,
    p_sleep: input.sleep_minutes,
    p_intention: input.intention,
    p_reflection: input.reflection,
    p_actions: input.actions,
  });
  if (error?.code === '40001' || error?.code === '22023')
    throw new DailyError(
      'Your day changed in another session or the local date changed. Reload the saved day before trying again.',
      409,
    );
  if (error)
    throw new DailyError(
      'We could not confirm the save. Your draft is still here. Reload the saved day before trying again.',
      503,
    );
  return readDaily();
}
