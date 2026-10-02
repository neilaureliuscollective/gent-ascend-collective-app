import { z } from 'zod';
export const progressionSchema = z.object({
  slotId: z.uuid(),
  title: z.string(),
  status: z.enum(['hold', 'ready']),
  reason: z.string(),
  evidence: z.array(
    z.object({
      sessionId: z.uuid(),
      day: z.iso.date(),
      mode: z.enum(['planned', 'shorter', 'lighter']),
      completedSets: z.number().int(),
      plannedSets: z.number().int(),
    }),
  ),
  proposal: z
    .object({
      ruleVersion: z.literal(1),
      token: z.string().regex(/^[a-f0-9]{64}$/),
      programVersion: z.number().int().positive(),
      exerciseId: z.uuid(),
      exercise: z.string(),
      from: z.number().int(),
      to: z.number().int(),
      sets: z.number().int(),
      load: z.number(),
      unit: z.enum(['kg', 'lb']),
      sourceIds: z.array(z.uuid()).length(2),
    })
    .nullable(),
});
export type ProgressionReview = z.infer<typeof progressionSchema>;
export type ProgressionDecision = {
  fromVersion: number;
  toVersion: number;
  createdAt: string;
  review: ProgressionReview;
};
