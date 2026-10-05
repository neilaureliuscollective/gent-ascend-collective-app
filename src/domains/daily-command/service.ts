import 'server-only';
import { authorizedPerson } from '@/domains/access/authorize';
import { readDaily, DailyError } from '@/domains/daily/service';
import { localDay } from '@/domains/daily/model';
import {
  deriveCommand,
  emptyArrival,
  shiftDay,
  type Arrival,
  type CommandData,
  type DailyCommandSignals,
  type Signal,
  type mutationSchema,
} from './model';
import type { z } from 'zod';

export async function readCommand(override?: Arrival): Promise<CommandData> {
  const owner = await authorizedPerson('daily.read');
  if (!owner)
    return {
      mode: 'preview',
      snapshot: null,
      arrival: emptyArrival,
      record: null,
      yesterday: null,
    };
  const { client, person } = owner;
  const day = localDay(new Date(), person.timezone),
    since = shiftDay(day, -6);
  const results = await Promise.allSettled([
    readDaily(),
    client
      .from('performance_checkins')
      .select('*')
      .eq('person_id', person.id)
      .gte('day', since)
      .lte('day', day)
      .order('day', { ascending: false }),
    client
      .from('performance_sessions')
      .select('*')
      .eq('person_id', person.id)
      .eq('status', 'complete')
      .gte('ended_at', `${shiftDay(day, -7)}T00:00:00Z`)
      .order('ended_at', { ascending: false })
      .limit(30),
    client.from('performance_fuel_targets').select('*').eq('person_id', person.id).maybeSingle(),
    client
      .from('performance_movements')
      .select('*')
      .eq('person_id', person.id)
      .gte('day', since)
      .lte('day', day)
      .limit(560),
    client
      .from('performance_recovery_routines')
      .select('*')
      .eq('person_id', person.id)
      .gte('day', since)
      .lte('day', day),
    client
      .from('grooming_events')
      .select('title,event_date')
      .eq('person_id', person.id)
      .gte('event_date', day)
      .lte('event_date', shiftDay(day, 7))
      .order('event_date')
      .limit(1),
    client
      .from('daily_command_records')
      .select('*')
      .eq('person_id', person.id)
      .gte('day', shiftDay(day, -1))
      .lte('day', day)
      .order('day', { ascending: false }),
  ] as const);
  const [
    dailyResult,
    checksResult,
    sessionsResult,
    targetsResult,
    movementResult,
    recoveryResult,
    eventsResult,
    recordsResult,
  ] = results;
  const unavailable: string[] = [];
  function value<T extends { error: unknown; data: unknown }>(
    result: PromiseSettledResult<T>,
    family: string,
  ): T['data'] | null {
    if (result.status === 'rejected' || result.value.error) {
      unavailable.push(family);
      return null;
    }
    return result.value.data;
  }
  const daily = dailyResult.status === 'fulfilled' ? dailyResult.value : null;
  if (!daily) unavailable.push('Daily');
  const checks = value(checksResult, 'Recovery / fuel') ?? [];
  const sessions = value(sessionsResult, 'Training') ?? [];
  const targets = value(targetsResult, 'Fuel references');
  const movements = value(movementResult, 'Movement') ?? [];
  const recovery = value(recoveryResult, 'Recovery practices') ?? [];
  const occasion = value(eventsResult, 'Occasions')?.[0];
  const records = value(recordsResult, 'Command history') ?? [];
  const record = records.find((r) => r.day === day) ?? null;
  const yesterday = records.find((r) => r.day === shiftDay(day, -1) && r.outcome);
  const dailyToday = daily?.entries.find((e) => e.day === day);
  const today = checks.find((c) => c.day === day);
  // Latest reported source per field wins. Explicit arrival values are retained for the day;
  // null means defer to existing same-day reports, never yesterday's recovery.
  const arrival: Arrival = override ?? record?.arrival ?? emptyArrival;
  const newestDaily =
    dailyToday?.updated_at && (!today || dailyToday.updated_at > today.updated_at);
  const resolved: Arrival = {
    ...arrival,
    sleepMinutes:
      arrival.sleepMinutes ??
      (newestDaily
        ? (dailyToday?.sleep_minutes ?? today?.sleep_minutes)
        : (today?.sleep_minutes ?? dailyToday?.sleep_minutes)) ??
      null,
    energy:
      arrival.energy ??
      (newestDaily
        ? (dailyToday?.energy ?? today?.energy)
        : (today?.energy ?? dailyToday?.energy)) ??
      null,
    soreness: arrival.soreness ?? today?.soreness ?? null,
  };
  const signals: Signal[] = [];
  if (yesterday?.outcome?.fit)
    signals.push({
      family: 'life',
      source: 'user-reported',
      detail: `Yesterday’s command fit: ${yesterday.outcome.fit}`,
      day: yesterday.day,
    });
  const report = (
    family: Signal['family'],
    detail: string,
    signalDay = day,
    source: Signal['source'] = 'user-reported',
  ) => signals.push({ family, detail, day: signalDay, source });
  if (resolved.sleepMinutes !== null)
    report('recovery', `Sleep reported: ${resolved.sleepMinutes} minutes`);
  if (resolved.energy !== null) report('recovery', `Energy reported: ${resolved.energy}/5`);
  if (resolved.soreness !== null) report('recovery', `Soreness reported: ${resolved.soreness}`);
  if (resolved.bandwidth) report('life', `Mental bandwidth reported: ${resolved.bandwidth}`);
  if (resolved.minutes !== null)
    report('life', `Available training time: ${resolved.minutes} minutes`);
  const ids = sessions.map((s) => s.id);
  const sets = ids.length
    ? await client
        .from('performance_sets')
        .select('session_id,done,effort')
        .eq('person_id', person.id)
        .in('session_id', ids)
        .limit(2880)
    : { data: [], error: null };
  if (sets.error) unavailable.push('Recorded sets');
  const recentTraining = sessions
    .map((s) => {
      const rows = (sets.data ?? []).filter((x) => x.session_id === s.id && x.done);
      const efforts = rows.flatMap((x) => (x.effort === null ? [] : [x.effort]));
      return {
        day: localDay(new Date(s.ended_at!), person.timezone),
        sets: rows.length,
        effort: efforts.length ? efforts.reduce((a, b) => a + b, 0) / efforts.length : null,
        pain: s.pain,
      };
    })
    .filter((s) => s.day >= since && s.day <= day);
  for (const s of recentTraining) {
    report('training', `${s.sets} completed sets recorded`, s.day, 'app-history');
    if (s.effort !== null)
      report('training', `Mean effort reported: ${Math.round(s.effort * 10) / 10}/10`, s.day);
    if (s.pain) report('training', 'Discomfort reported during this session', s.day);
  }
  const pastSleep = checks.filter((c) => c.day < day && c.sleep_minutes !== null);
  if (pastSleep.length >= 3)
    report(
      'recovery',
      `Recent sleep reports average ${Math.round(pastSleep.reduce((n, c) => n + c.sleep_minutes!, 0) / pastSleep.length)} minutes across ${pastSleep.length} days`,
      pastSleep[0]!.day,
    );
  for (const r of recovery)
    report(
      'recovery',
      `Recovery practice reported: ${r.routine.action}; follow-through ${r.routine.outcome ?? 'unknown'}`,
      r.day,
    );
  const minutes = movements.filter((m) => !m.entry.voided).reduce((n, m) => n + m.entry.minutes, 0);
  if (minutes)
    report(
      'movement',
      `${minutes} movement minutes logged across the last seven days`,
      day,
      'app-history',
    );
  if (today?.water_ml !== null && today?.water_ml !== undefined)
    report('fuel', `Water logged today: ${today.water_ml} ml`);
  if (today?.calories !== null && today?.calories !== undefined)
    report(
      'fuel',
      `Food log: ${today.calories} calories; ${today.nutrition_complete ? 'marked complete' : 'partial'}`,
    );
  if (today?.protein !== null && today?.protein !== undefined)
    report(
      'fuel',
      `Protein logged: ${today.protein} g; ${today.nutrition_complete ? 'marked complete' : 'partial'}`,
    );
  const priority =
    dailyToday?.actions.find((a) => !a.done)?.title ||
    dailyToday?.intention ||
    yesterday?.outcome?.tomorrow ||
    daily?.carryForward?.unfinished[0] ||
    daily?.carryForward?.tomorrow ||
    daily?.goal?.next_step ||
    null;
  if (priority) report('life', `Saved priority: ${priority}`);
  const blocker = daily?.carryForward?.blocker || null;
  if (blocker) report('life', `Carry-forward blocker: ${blocker}`, daily!.carryForward!.day);
  if (occasion) report('occasion', `Saved occasion: ${occasion.title}`, occasion.event_date);
  const input: DailyCommandSignals = {
    day,
    arrival: resolved,
    signals,
    recentTraining,
    water: today?.water_ml ?? null,
    waterTarget: targets?.targets.waterMl ?? null,
    priority,
    blocker,
    goal: daily?.goal?.title ?? null,
    ritual: null,
    occasion: occasion ? { title: occasion.title, day: occasion.event_date } : null,
    unavailable,
    priorFit: yesterday?.outcome?.fit,
  };
  return {
    ownerId: person.id,
    mode: 'personal',
    arrival,
    record,
    yesterday: yesterday?.outcome ? { day: yesterday.day, outcome: yesterday.outcome } : null,
    snapshot: deriveCommand(input),
  };
}

export async function saveCommand(input: z.infer<typeof mutationSchema>): Promise<CommandData> {
  const owner = await authorizedPerson('daily.write');
  if (!owner) throw new DailyError('Sign in to save your command.', 401);
  if (input.ownerId !== owner.person.id)
    throw new DailyError('Your account changed. Reopen Daily Command.', 409);
  if (input.day !== localDay(new Date(), owner.person.timezone))
    throw new DailyError('The day changed. Reload before saving.', 409);
  const data = await readCommand(input.kind === 'arrival' ? input.arrival : undefined);
  if (!data.snapshot || data.snapshot.unavailable.includes('Command history'))
    throw new DailyError('Command history is unavailable. Nothing was saved.', 503);
  if (
    input.kind === 'outcome' &&
    (!data.record ||
      input.outcome.decisions.some(
        (x) => !data.record!.snapshot.decisions.some((d) => d.id === x.id),
      ) ||
      new Set(input.outcome.decisions.map((x) => x.id)).size !== input.outcome.decisions.length)
  )
    throw new DailyError('Review the saved decisions before closing the loop.', 409);
  const result = await owner.client.rpc('daily_command_save', {
    p_request: input.requestId,
    p_day: input.day,
    p_version: input.version,
    p_kind: input.kind,
    p_arrival: input.kind === 'arrival' ? input.arrival : data.record!.arrival,
    p_snapshot: input.kind === 'arrival' ? data.snapshot : data.record!.snapshot,
    p_outcome: input.kind === 'outcome' ? input.outcome : null,
  });
  if (
    result.error?.code === '40001' ||
    result.error?.code === '22023' ||
    result.error?.code === '23505'
  )
    throw new DailyError(
      'The command changed or this request was already used. Reload before saving.',
      409,
    );
  if (result.error)
    throw new DailyError('The save could not be confirmed. Reload before retrying.', 503);
  return readCommand();
}
