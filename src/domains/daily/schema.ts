import { z } from 'zod';
export const actionSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1).max(100),
  done: z.boolean(),
});
export const daySchema = z.object({
  day: z.iso.date(),
  version: z.number().int().min(0),
  energy: z.number().int().min(1).max(5).nullable(),
  sleep_minutes: z.number().int().min(0).max(1440).nullable(),
  intention: z.string().trim().max(160),
  reflection: z.string().trim().max(500),
  actions: z
    .array(actionSchema)
    .max(5)
    .refine(
      (items) => new Set(items.map((a) => a.id)).size === items.length,
      'Action IDs must be unique.',
    ),
});
export type DayInput = z.infer<typeof daySchema>;
export type DayAction = z.infer<typeof actionSchema>;
