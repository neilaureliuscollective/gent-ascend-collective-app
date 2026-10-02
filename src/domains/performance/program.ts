import type { PerformanceData, Plan, Prescription, Program } from './schema';
import { startSession } from './model';
export const modeLabels: Record<Prescription['mode'], string> = {
  planned: 'As planned',
  shorter: 'Fit my time',
  lighter: 'Fewer sets',
};
// A transparent planning estimate, not a physiological model or a duration promise.
export function estimatedMinutes(plan: Plan) {
  return Math.ceil(
    5 + plan.exercises.reduce((n, e) => n + 1 + (e.sets * (45 + e.restSeconds)) / 60, 0),
  );
}
export function preparePlan(source: Plan, mode: Prescription['mode'], timeBudget: number): Plan {
  const plan = structuredClone(source);
  if (mode === 'lighter')
    plan.exercises = plan.exercises.map((e) => ({ ...e, sets: Math.max(1, e.sets - 1) }));
  if (mode === 'shorter') {
    while (estimatedMinutes(plan) > timeBudget) {
      const index = plan.exercises.findLastIndex((e) => e.sets > 1);
      if (index >= 0) plan.exercises[index]!.sets--;
      else if (plan.exercises.length > 1) plan.exercises.pop();
      else break;
    }
  }
  return plan;
}
export function preparationChanges(original: Plan, adjusted: Plan) {
  return original.exercises.flatMap((e) => {
    const next = adjusted.exercises.find((x) => x.id === e.id);
    return !next
      ? [`${e.name}: omitted today`]
      : next.sets !== e.sets
        ? [`${e.name}: ${e.sets} → ${next.sets} sets`]
        : [];
  });
}
export function nextProgramSlot(data: PerformanceData) {
  return (
    data.program?.data.sessions.find((s) => s.id === data.program?.nextSlotId) ??
    data.program?.data.sessions[0] ??
    null
  );
}
export function createProgram(plan: Plan): Program {
  return {
    title: 'My training cycle',
    sessions: [{ id: crypto.randomUUID(), plan: structuredClone(plan) }],
  };
}
export function startProgramSession(prescription: Prescription) {
  return {
    ...startSession(prescription.plan, prescription.programVersion, prescription.plan.unit),
    prescription,
  };
}
export function preparationSignals(data: PerformanceData) {
  const check = data.checkins.find((c) => c.data.day === data.today)?.data;
  const signals: string[] = [];
  if (!check) signals.push('No check-in today. Recovery is unknown.');
  if (check?.sleepMinutes !== null && check?.sleepMinutes !== undefined && check.sleepMinutes < 360)
    signals.push('You recorded under six hours of sleep today. Consider fewer sets or recovery.');
  if (check?.energy !== null && check?.energy !== undefined && check.energy <= 2)
    signals.push('You reported low energy today. Consider fewer sets or recovery.');
  if (check?.soreness === 'high')
    signals.push('You reported high soreness. Review movement comfort before deciding.');
  if (data.profile?.data.limitations.trim())
    signals.push(
      'You have recorded limitations. This adjustment does not assess which movements are suitable.',
    );
  const latest = data.sessions
    .filter((s) => s.data.status === 'complete')
    .sort((a, b) => b.data.startedAt.localeCompare(a.data.startedAt))[0];
  if (latest?.data.pain)
    signals.push(
      'Your last completed session recorded discomfort. Review that before repeating the movements.',
    );
  return signals;
}
