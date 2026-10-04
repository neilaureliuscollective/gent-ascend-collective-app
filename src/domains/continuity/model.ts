import { daysEnding, localDay, type DailyData } from '@/domains/daily/model';
export type ContinuityRecords = {
  sessions:
    | { id: string; title: string; status: string; started_at: string; ended_at: string | null }[]
    | null;
  rituals: { id: string; title: string; kind: string }[] | null;
  checkins: { ritual_id: string; done: boolean; occurred_at: string }[] | null;
};
export function projectContinuity(daily: DailyData, records: ContinuityRecords) {
  const dates = daysEnding(daily.today, 7);
  const inWindow = (at: string) => {
    const date = new Date(at);
    return Number.isFinite(date.getTime()) && dates.includes(localDay(date, daily.timezone));
  };
  const completedSessions =
    records.sessions?.filter(
      (s) => s.status === 'complete' && s.ended_at && inWindow(s.ended_at),
    ) ?? [];
  const practices = records.checkins?.filter((c) => inWindow(c.occurred_at)) ?? [];
  // Multiple same-day check-ins are observations. Latest for each ritual/day determines practice.
  const latest = new Map<string, (typeof practices)[number]>();
  for (const practice of practices) {
    const key = `${practice.ritual_id}:${localDay(new Date(practice.occurred_at), daily.timezone)}`;
    if (!latest.has(key) || latest.get(key)!.occurred_at < practice.occurred_at)
      latest.set(key, practice);
  }
  const week = dates.map((day) => {
    const entry = daily.entries.find((e) => e.day === day);
    return {
      day,
      actions: entry?.actions.length ?? 0,
      completed: entry?.actions.filter((a) => a.done).length ?? 0,
      reviewed: !!entry?.review,
      recorded: !!entry,
      sessions:
        records.sessions === null
          ? null
          : completedSessions.filter((s) => localDay(new Date(s.ended_at!), daily.timezone) === day)
              .length,
      rituals:
        records.checkins === null
          ? null
          : [...latest.values()].filter(
              (c) => c.done && localDay(new Date(c.occurred_at), daily.timezone) === day,
            ).length,
    };
  });
  const active = records.sessions
    ?.filter((s) => s.status === 'active')
    .sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
  const todayEntry = daily.entries.find((e) => e.day === daily.today);
  const nextAction = todayEntry?.actions.find((a) => !a.done);
  const currentRituals =
    records.rituals?.map((ritual) => ({
      title: ritual.title,
      kind: ritual.kind,
      practicedToday: latest.get(`${ritual.id}:${daily.today}`)?.done ?? false,
    })) ?? [];
  return {
    mode: daily.mode,
    today: daily.today,
    timezone: daily.timezone,
    start: dates[0]!,
    week,
    actionsCompleted: week.reduce((n, d) => n + d.completed, 0),
    actionsPlanned: week.reduce((n, d) => n + d.actions, 0),
    recordedDays: week.filter((d) => d.recorded).length,
    reviewedDays: week.filter((d) => d.reviewed).length,
    sessionsCompleted: records.sessions === null ? null : completedSessions.length,
    practiceDays:
      records.checkins === null
        ? null
        : [
            ...new Set(
              [...latest.values()]
                .filter((c) => c.done)
                .map((c) => localDay(new Date(c.occurred_at), daily.timezone)),
            ),
          ].length,
    activeSession: active ? { title: active.title, href: '/app/performance' } : null,
    nextAction: nextAction?.title ?? null,
    rituals: currentRituals,
    conversation: daily.conversation,
    unavailable: [
      records.sessions === null && 'Training',
      records.rituals === null && 'Rituals',
      records.checkins === null && 'Grooming practice',
    ].filter(Boolean) as string[],
  };
}
export type Continuity = ReturnType<typeof projectContinuity>;
