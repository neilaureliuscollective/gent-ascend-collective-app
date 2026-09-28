import { z } from 'zod';
import { progressionSchema } from './progression';
import { planSchema, sessionSchema } from './schema';
import { localDate } from './model';

export const outcomeEvidenceSchema = z.object({
  fromVersion: z.number().int().positive(),
  toVersion: z.number().int().positive(),
  createdAt: z.iso.datetime({ offset: true }),
  review: progressionSchema,
  approvedPlan: planSchema,
  revisedAt: z.iso.datetime({ offset: true }).nullable(),
  sessions: z.array(sessionSchema).max(2),
});
export type OutcomeEvidence = z.infer<typeof outcomeEvidenceSchema>;
export type AttemptOutcome = {
  sessionId: string;
  day: string;
  status: 'met' | 'below' | 'adapted' | 'abandoned' | 'active' | 'discomfort' | 'unverified';
  label: string;
  detail: string;
  unit: 'kg' | 'lb';
  completedSets: number;
  targetSets: number;
  reps: (number | null)[];
  loads: (number | null)[];
  maxEffort: number | null;
  effortComplete: boolean;
};
export type DecisionOutcome = {
  toVersion: number;
  state: 'waiting' | 'observed' | 'review' | 'revised';
  title: string;
  summary: string;
  revisedAt: string | null;
  attempts: AttemptOutcome[];
};

/** Describes the first two attempts, never selects only successful workouts.
 * This is a versioned observation, not a training prescription or causal estimate. */
export function decisionOutcome(
  evidence: OutcomeEvidence,
  timezone: string,
  now = new Date().toISOString(),
): DecisionOutcome {
  const p = evidence.review.proposal;
  const attempts: AttemptOutcome[] = evidence.sessions.map((session) => {
    const sets = session.sets.filter((s) => s.exerciseId === p?.exerciseId);
    const recorded = sets.filter((s) => s.done);
    const efforts = recorded.flatMap((s) => (s.effort === null ? [] : [s.effort]));
    const base = {
      sessionId: session.id,
      day: localDate(session.startedAt, timezone),
      unit: session.unit,
      completedSets: recorded.length,
      targetSets: p?.sets ?? 0,
      reps: recorded.map((s) => s.reps),
      loads: recorded.map((s) => s.load),
      maxEffort: efforts.length ? Math.max(...efforts) : null,
      effortComplete: recorded.length > 0 && efforts.length === recorded.length,
    };
    const result = (
      status: AttemptOutcome['status'],
      label: string,
      detail: string,
    ): AttemptOutcome => ({ ...base, status, label, detail });
    if (
      !p ||
      Date.parse(session.startedAt) > Date.parse(now) ||
      (session.endedAt && Date.parse(session.endedAt) > Date.parse(now))
    )
      return result(
        'unverified',
        'Check record dates',
        'This record cannot yet be used as an observed outcome.',
      );
    if (session.pain)
      return result(
        'discomfort',
        'Discomfort recorded',
        'Review this workout before considering another increase. This record does not establish a cause.',
      );
    if (session.status === 'active')
      return result(
        'active',
        'Workout in progress',
        'Finish and sync this workout to see its result.',
      );
    if (session.status === 'abandoned')
      return result(
        'abandoned',
        'Workout ended early',
        'This attempt stays in the record; it is not replaced with a later workout.',
      );
    const prescription = session.prescription;
    const approved = evidence.approvedPlan;
    // Compare semantic plan fields, independent of JSON object key order.
    const samePlan =
      prescription?.originalPlan.title === approved.title &&
      prescription.originalPlan.unit === approved.unit &&
      prescription.originalPlan.exercises.length === approved.exercises.length &&
      approved.exercises.every((exercise, i) => {
        const original = prescription.originalPlan.exercises[i];
        return (
          original &&
          (Object.keys(exercise) as (keyof typeof exercise)[]).every(
            (key) => original[key] === exercise[key],
          )
        );
      });
    if (
      !prescription ||
      prescription.slotId !== evidence.review.slotId ||
      !samePlan ||
      prescription.mode !== 'planned' ||
      session.unit !== p.unit ||
      sets.length !== p.sets ||
      sets.some(
        (s) => s.targetReps !== p.to || s.targetLoad !== p.load || s.exercise !== p.exercise,
      )
    )
      return result(
        'adapted',
        'Session adapted',
        'The session or prescription differs from the approved trial. It is still recorded training.',
      );
    if (recorded.some((s) => s.load !== p.load))
      return result(
        'adapted',
        'Load changed',
        'Recorded load differs from the trial; these reps are not treated as a like-for-like result.',
      );
    const met =
      recorded.length === p.sets && recorded.every((s) => s.reps !== null && s.reps >= p.to);
    if (!met)
      return result(
        'below',
        'Target not fully recorded',
        'Some planned sets or reps were not recorded at the new target. Keep the actual result visible when reviewing your plan.',
      );
    return result(
      'met',
      'Rep target met',
      base.effortComplete
        ? 'All sets for this exercise met the approved rep target at the same load. Effort is shown separately.'
        : 'All sets for this exercise met the approved rep target at the same load. Effort is missing for one or more sets.',
    );
  });
  const base = { toVersion: evidence.toVersion, revisedAt: evidence.revisedAt, attempts };
  if (attempts.length === 0)
    return {
      ...base,
      state: evidence.revisedAt ? 'revised' : 'waiting',
      title: evidence.revisedAt
        ? 'Plan changed before a recorded trial'
        : 'Waiting for the next workout',
      summary: evidence.revisedAt
        ? 'This session was revised again. No workout tested this approved version before that revision.'
        : 'Your change is saved. The next two attempts for this session will appear here after syncing.',
    };
  if (attempts.some((a) => a.status !== 'met'))
    return {
      ...base,
      state: 'review',
      title: 'Review what happened',
      summary:
        'The first attempts include an unfinished, adapted or below-target record. Review the details before deciding your next step.',
    };
  const distinctDays = new Set(attempts.map((a) => a.day)).size;
  return {
    ...base,
    state: 'observed',
    title:
      attempts.length === 2 && distinctDays === 2
        ? 'Target met on two separate days'
        : attempts.length === 2
          ? 'Target met twice on one day'
          : 'Target met in the first workout',
    summary:
      'These are recorded results for the changed exercise, not proof of a strength gain or permission for another increase. Current progression is reviewed separately.',
  };
}
