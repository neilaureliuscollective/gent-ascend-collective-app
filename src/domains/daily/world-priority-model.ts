import { z } from 'zod';

export const priorityInput = z
  .object({
    ownerId: z.uuid(),
    day: z.iso.date(),
    version: z.number().int().min(0),
    intention: z.string().trim().min(1).max(160),
    nextAction: z.string().trim().min(1).max(100).optional(),
  })
  .strict();
export type PriorityInput = z.infer<typeof priorityInput>;

export const prioritySnapshot = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('guest') }),
  z.object({
    mode: z.literal('personal'),
    ownerId: z.uuid(),
    day: z.iso.date(),
    timezone: z.string(),
    version: z.number().int().min(0),
    intention: z.string().max(160),
    updatedAt: z.string().nullable(),
    nextAction: z.string().max(100).nullable(),
  }),
]);
export type PrioritySnapshot = z.infer<typeof prioritySnapshot>;
export type PersonalPriority = Extract<PrioritySnapshot, { mode: 'personal' }>;
