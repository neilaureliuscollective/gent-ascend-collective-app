import { z } from 'zod';
const calendarDate = z.string().refine((value) => {
  if (value === '') return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '2100-12-31')
    return false;
  const parsed = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Choose a valid date between 1900 and 2100.');
export const goalFieldsSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Give your goal a name.')
    .max(120, 'Use 120 characters or fewer.'),
  domain: z.enum(['body', 'mind', 'life']),
  reason: z.string().trim().max(600, 'Use 600 characters or fewer.'),
  next_step: z
    .string()
    .trim()
    .min(1, 'Choose a concrete next step.')
    .max(280, 'Use 280 characters or fewer.'),
  target_date: calendarDate,
});
export const goalMutationSchema = goalFieldsSchema.extend({
  id: z.uuid(),
  version: z.coerce.number().int().nonnegative(),
});
export const goalTransitionSchema = z.object({
  id: z.uuid(),
  version: z.coerce.number().int().positive(),
  status: z.enum(['completed', 'archived']),
});
export type GoalInput = z.infer<typeof goalMutationSchema>;
export type GoalTransition = z.infer<typeof goalTransitionSchema>;
export const domainLabels = {
  body: 'Body & performance',
  mind: 'Mind & direction',
  life: 'Life & legacy',
} as const;
export function formatCalendarDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value + 'T00:00:00Z'));
}
