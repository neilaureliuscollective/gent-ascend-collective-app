import 'server-only';
import { authorizedPerson } from '@/domains/access/authorize';
import { readDaily, DailyError } from '@/domains/daily/service';
import { commandAuthority } from './autonomy';
import { projectCommand } from './projection';

/** Request-local preparation: no provider, background task, shared cache or write. */
export async function readCommand() {
  const data = await readDaily();
  const authority = commandAuthority('assemble_briefing', data.mode === 'personal');
  return {
    data,
    opening: projectCommand(data),
    asOf: new Date().toISOString(),
    prepared: authority.executable,
  };
}

export type PreparedMoveInput = {
  ownerId: string;
  day: string;
  version: number;
  source: 'review' | 'goal';
  title: string;
  approve: true;
};

export async function adoptPreparedMove(input: PreparedMoveInput) {
  const context = await authorizedPerson('daily.write');
  if (!commandAuthority('adopt_prepared_move', !!context, input.approve).executable || !context)
    throw new DailyError('Sign in to confirm your next move.', 401);
  if (input.ownerId !== context.person.id)
    throw new DailyError('Your account changed. Reload before confirming.', 409);
  // Read fresh sources with this same verified person/session. Client text is a guard only.
  const data = await readDaily(context);
  const prepared = projectCommand(data);
  if (
    input.day !== data.today ||
    input.version !== prepared.day.version ||
    input.source !== prepared.move.kind ||
    input.title !== prepared.move.title ||
    !prepared.canAdopt ||
    prepared.day.actions.length
  )
    throw new DailyError('Your saved next move changed. Reload before confirming.', 409);
  const day = prepared.day;
  const { error } = await context.client.rpc('daily_save', {
    p_day: data.today,
    p_version: day.version,
    p_energy: day.energy,
    p_sleep: day.sleep_minutes,
    p_intention: day.intention,
    p_reflection: day.reflection,
    p_actions: [{ id: crypto.randomUUID(), title: prepared.move.title, done: false }],
  });
  if (error?.code === '40001' || error?.code === '22023')
    throw new DailyError('Your day changed. Reload before confirming.', 409);
  if (error) throw new DailyError('The move could not be confirmed. Reload before retrying.', 503);
  return { saved: true as const, day: data.today };
}
