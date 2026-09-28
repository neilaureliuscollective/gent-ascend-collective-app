import type { PerformanceData, Plan, Profile, Session } from './schema';
export const goalLabels: Record<Profile['goal'], string> = {
  strength: 'Build strength',
  muscle: 'Build muscle',
  consistency: 'Build consistency',
  'body-composition': 'Improve body composition',
};
export const defaultProfile: Profile = {
  goal: 'strength',
  experience: 'returning',
  daysPerWeek: 3,
  minutes: 40,
  equipment: 'gym',
  limitations: '',
  unit: 'lb',
};
export function starterPlan(profile: Profile, id = () => crypto.randomUUID()): Plan {
  const names =
    profile.equipment === 'gym'
      ? ['Leg press', 'Machine chest press', 'Seated cable row']
      : profile.equipment === 'dumbbells'
        ? ['Goblet squat', 'Dumbbell floor press', 'One-arm dumbbell row']
        : ['Chair squat', 'Incline push-up', 'Glute bridge'];
  return {
    title: 'Your strength practice',
    unit: profile.unit,
    exercises: names.map((name) => ({
      id: id(),
      name,
      sets: 2,
      reps: 8,
      load: 0,
      restSeconds: 90,
    })),
  };
}
export function startSession(plan: Plan, planVersion: number, unit: 'kg' | 'lb'): Session {
  return {
    id: crypto.randomUUID(),
    title: plan.title,
    planVersion,
    startedAt: new Date().toISOString(),
    endedAt: null,
    status: 'active',
    unit,
    pain: false,
    note: '',
    sets: plan.exercises.flatMap((e) =>
      Array.from({ length: e.sets }, () => ({
        id: crypto.randomUUID(),
        exerciseId: e.id,
        exercise: e.name,
        targetReps: e.reps,
        targetLoad: e.load,
        reps: e.reps,
        load: e.load,
        effort: null,
        done: false,
      })),
    ),
  };
}
export function weeklyReview(data: PerformanceData) {
  const start = new Date(`${data.today}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 6);
  const since = start.toISOString().slice(0, 10);
  const completed = data.sessions.filter(
    (s) =>
      s.data.status === 'complete' &&
      localDate(s.data.endedAt!, data.timezone) >= since &&
      localDate(s.data.endedAt!, data.timezone) <= data.today,
  );
  const checkins = data.checkins.filter((c) => c.data.day >= since && c.data.day <= data.today);
  const sleeps = checkins.flatMap((c) =>
    c.data.sleepMinutes === null ? [] : [c.data.sleepMinutes],
  );
  const recordedSets = completed.reduce((n, s) => n + s.data.sets.filter((x) => x.done).length, 0);
  return {
    sessions: completed.length,
    sets: recordedSets,
    checkins: checkins.length,
    sleepMinutes: sleeps.length
      ? Math.round(sleeps.reduce((a, b) => a + b, 0) / sleeps.length)
      : null,
    sleepDays: sleeps.length,
  };
}
export function localDate(iso: string, timezone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}
export type Adjustment = {
  exerciseId: string;
  exercise: string;
  from: number;
  to: number;
  sourceIds: [string, string];
  reason: string;
};
export function nextAdjustment(data: PerformanceData): Adjustment | null {
  if (data.program || !data.plan || !data.profile || data.profile.data.limitations.trim())
    return null;
  const today = data.checkins.find((c) => c.data.day === data.today)?.data;
  if (
    today &&
    (today.soreness === 'high' ||
      (today.energy !== null && today.energy <= 2) ||
      (today.sleepMinutes !== null && today.sleepMinutes < 360))
  )
    return null;
  const recent = data.sessions
    .filter((s) => s.data.status === 'complete')
    .sort((a, b) => b.data.startedAt.localeCompare(a.data.startedAt))
    .slice(0, 2);
  if (
    recent.length < 2 ||
    recent.some(
      (s) =>
        s.data.pain ||
        s.data.planVersion !== data.plan!.version ||
        s.data.unit !== data.plan!.data.unit,
    )
  )
    return null;
  const daysAgo =
    (new Date(`${data.today}T23:59:59Z`).getTime() -
      new Date(recent[1]!.data.startedAt).getTime()) /
    86400000;
  if (daysAgo > 21 || daysAgo < 0) return null;
  for (const exercise of data.plan.data.exercises) {
    if (exercise.reps >= 20) continue;
    const meets = recent.every((s) => {
      const sets = s.data.sets.filter((x) => x.exerciseId === exercise.id);
      return (
        sets.length === exercise.sets &&
        sets.every(
          (x) =>
            x.done &&
            x.exercise === exercise.name &&
            x.reps !== null &&
            x.reps >= exercise.reps &&
            x.load === exercise.load &&
            x.effort !== null &&
            x.effort <= 7,
        )
      );
    });
    if (meets)
      return {
        exerciseId: exercise.id,
        exercise: exercise.name,
        from: exercise.reps,
        to: exercise.reps + 1,
        sourceIds: [recent[0]!.data.id, recent[1]!.data.id],
        reason:
          'You completed every planned set at this load in your last two sessions and reported effort of 7/10 or lower. Try one extra rep per set; keep the load unchanged.',
      };
  }
  return null;
}
export function todayDirection(data: PerformanceData) {
  if (!data.profile || (!data.plan && !data.program))
    return {
      title: 'Give your training a direction.',
      text: 'Set your goal, available time and equipment. Then shape a practice you can repeat.',
    };
  const checkin = data.checkins.find((c) => c.data.day === data.today)?.data;
  if (checkin?.soreness === 'high' || data.sessions[0]?.data.pain)
    return {
      title: 'Check how movement feels.',
      text: 'You reported soreness or discomfort. Review your session before starting; avoid movements that hurt.',
    };
  if (
    checkin &&
    ((checkin.energy !== null && checkin.energy <= 2) ||
      (checkin.sleepMinutes !== null && checkin.sleepMinutes < 360))
  )
    return {
      title: 'Make room for a lighter day.',
      text: 'Your check-in suggests a demanding day. You can keep the plan, shorten it, or choose recovery. No change has been made.',
    };
  return {
    title: 'Build on your last session.',
    text: 'Your plan is ready. Record what you actually do, then let the next decision follow the evidence.',
  };
}
export function samplePerformance(): PerformanceData {
  return {
    mode: 'preview',
    owner: null,
    today: '2026-09-28',
    timezone: 'UTC',
    profile: null,
    plan: null,
    checkins: [],
    sessions: [],
  };
}
