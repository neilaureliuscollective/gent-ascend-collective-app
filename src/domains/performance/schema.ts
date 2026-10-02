import type { DecisionOutcome } from './outcomes';
import type { ProgressionReview, ProgressionDecision } from './progression';
import { z } from 'zod';
export const exerciseSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(70),
    sets: z.number().int().min(1).max(8),
    reps: z.number().int().min(1).max(30),
    load: z.number().min(0).max(1500),
    restSeconds: z.number().int().min(15).max(600),
    progression: z.enum(['review', 'manual']).optional(),
  })
  .strict();
export const profileSchema = z
  .object({
    goal: z.enum(['strength', 'muscle', 'consistency', 'body-composition']),
    experience: z.enum(['new', 'returning', 'consistent']),
    daysPerWeek: z.number().int().min(1).max(6),
    minutes: z.number().int().min(10).max(120),
    equipment: z.enum(['gym', 'dumbbells', 'bodyweight']),
    limitations: z.string().trim().max(500),
    unit: z.enum(['kg', 'lb']),
  })
  .strict();
export const planSchema = z
  .object({
    title: z.string().trim().min(1).max(80),
    unit: z.enum(['kg', 'lb']),
    exercises: z.array(exerciseSchema).min(1).max(12),
  })
  .strict()
  .refine(
    (p) => new Set(p.exercises.map((e) => e.id)).size === p.exercises.length,
    'Exercise IDs must be unique.',
  );
export const programSchema = z
  .object({
    title: z.string().trim().min(1).max(80),
    sessions: z
      .array(z.object({ id: z.uuid(), plan: planSchema }).strict())
      .min(1)
      .max(6),
  })
  .strict()
  .refine(
    (p) => new Set(p.sessions.map((s) => s.id)).size === p.sessions.length,
    'Session IDs must be unique.',
  );
export const prescriptionSchema = z
  .object({
    ruleVersion: z.literal(1),
    programVersion: z.number().int().positive(),
    slotId: z.uuid(),
    mode: z.enum(['planned', 'shorter', 'lighter']),
    timeBudget: z.number().int().min(10).max(120),
    plan: planSchema,
    originalPlan: planSchema,
  })
  .strict();
export const checkinSchema = z
  .object({
    day: z.iso.date(),
    sleepMinutes: z.number().int().min(0).max(1440).nullable(),
    energy: z.number().int().min(1).max(5).nullable(),
    soreness: z.enum(['none', 'mild', 'high']).nullable(),
    weight: z.number().min(20).max(700).nullable(),
    unit: z.enum(['kg', 'lb']),
    calories: z.number().int().min(0).max(15000).nullable(),
    protein: z.number().min(0).max(1000).nullable(),
    waterMl: z.number().int().min(0).max(15000).nullable(),
    nutritionComplete: z.boolean(),
  })
  .strict();
export const setSchema = z
  .object({
    id: z.uuid(),
    exerciseId: z.uuid(),
    exercise: z.string().trim().min(1).max(70),
    targetReps: z.number().int().min(1).max(30),
    targetLoad: z.number().min(0).max(1500),
    reps: z.number().int().min(0).max(100).nullable(),
    load: z.number().min(0).max(1500).nullable(),
    effort: z.number().int().min(1).max(10).nullable(),
    done: z.boolean(),
  })
  .strict()
  .refine(
    (s) => !s.done || (s.reps !== null && s.reps > 0 && s.load !== null),
    'Completed sets need reps and load.',
  );
export const sessionSchema = z
  .object({
    id: z.uuid(),
    title: z.string().trim().min(1).max(80),
    planVersion: z.number().int().min(1),
    prescription: prescriptionSchema.optional(),
    startedAt: z.iso.datetime({ offset: true }),
    endedAt: z.iso.datetime({ offset: true }).nullable(),
    status: z.enum(['active', 'complete', 'abandoned']),
    unit: z.enum(['kg', 'lb']),
    pain: z.boolean(),
    note: z.string().trim().max(500),
    sets: z.array(setSchema).min(0).max(96),
  })
  .strict()
  .refine((s) => new Set(s.sets.map((x) => x.id)).size === s.sets.length, 'Set IDs must be unique.')
  .refine(
    (s) => s.status !== 'complete' || s.sets.some((x) => x.done),
    'Record at least one set to finish.',
  )
  .refine(
    (s) => (s.status === 'active' ? s.endedAt === null : s.endedAt !== null),
    'Session status and finish time must agree.',
  )
  .refine(
    (s) => !s.endedAt || new Date(s.endedAt).getTime() >= new Date(s.startedAt).getTime(),
    'Finish time must follow start time.',
  );
export const fuelTargetsSchema = z
  .object({
    calories: z.number().int().positive().max(15000).nullable(),
    protein: z.number().positive().max(1000).nullable(),
    waterMl: z.number().int().positive().max(15000).nullable(),
    goalWeight: z.number().min(20).max(700).nullable(),
    unit: z.enum(['kg', 'lb']),
  })
  .strict();
export const recoveryRoutineSchema = z
  .object({
    day: z.iso.date(),
    action: z.enum(['quiet-time', 'screen-break', 'gentle-mobility', 'rest']),
    minutes: z.number().int().min(5).max(60),
    cue: z.string().trim().max(120),
    outcome: z.enum(['done', 'partial', 'skipped']).nullable(),
  })
  .strict();
export type RecoveryRoutine = z.infer<typeof recoveryRoutineSchema>;
export type FuelTargets = z.infer<typeof fuelTargetsSchema>;
export const movementSchema = z
  .object({
    id: z.uuid(),
    day: z.iso.date(),
    kind: z.enum(['walk', 'run', 'cycle', 'row', 'swim', 'cardio', 'mobility']),
    minutes: z.number().int().min(1).max(1440),
    distance: z.number().positive().max(1000).nullable(),
    unit: z.enum(['km', 'mi']),
    intensity: z.enum(['easy', 'moderate', 'vigorous']).nullable(),
    note: z.string().trim().max(240),
    voided: z.boolean(),
  })
  .strict()
  .refine(
    (x) => x.kind !== 'mobility' || (x.distance === null && x.intensity === null),
    'Mobility uses duration only.',
  );
export type Movement = z.infer<typeof movementSchema>;
const base = { requestId: z.uuid(), expectedVersion: z.number().int().min(0) };
export const mutationSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('movement'), ...base, payload: movementSchema }).strict(),
  z
    .object({ kind: z.literal('recovery-routine'), ...base, payload: recoveryRoutineSchema })
    .strict(),
  z.object({ kind: z.literal('fuel-targets'), ...base, payload: fuelTargetsSchema }).strict(),
  z.object({ kind: z.literal('profile'), ...base, payload: profileSchema }).strict(),
  z.object({ kind: z.literal('plan'), ...base, payload: planSchema }).strict(),
  z.object({ kind: z.literal('program'), ...base, payload: programSchema }).strict(),
  z.object({ kind: z.literal('checkin'), ...base, payload: checkinSchema }).strict(),
  z
    .object({ kind: z.literal('session'), owner: z.uuid(), ...base, payload: sessionSchema })
    .strict(),
  z.object({ kind: z.literal('adapt'), ...base, sourceIds: z.array(z.uuid()).length(2) }).strict(),
  z
    .object({
      kind: z.literal('progress'),
      ...base,
      slotId: z.uuid(),
      token: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict(),
  z.object({ kind: z.literal('review'), requestId: z.uuid() }).strict(),
]);
export type Program = z.infer<typeof programSchema>;
export type Prescription = z.infer<typeof prescriptionSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type Plan = z.infer<typeof planSchema>;
export type Checkin = z.infer<typeof checkinSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type Mutation = z.infer<typeof mutationSchema>;
export type Stored<T> = { data: T; version: number; updatedAt: string };
export type PerformanceData = {
  mode: 'personal' | 'preview';
  owner: string | null;
  today: string;
  timezone: string;
  profile: Stored<Profile> | null;
  plan: Stored<Plan> | null;
  program?: (Stored<Program> & { nextSlotId: string }) | null;
  fuelTargets?: Stored<FuelTargets> | null;
  recoveryRoutines?: Stored<RecoveryRoutine>[];
  movements?: Stored<Movement>[];
  progression?: ProgressionReview[];
  progressionDecisions?: ProgressionDecision[];
  outcomes?: DecisionOutcome[];
  checkins: Stored<Checkin>[];
  sessions: Stored<Session>[];
};
