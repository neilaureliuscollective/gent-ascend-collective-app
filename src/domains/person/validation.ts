import { z } from 'zod';
export const profileSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(1, 'Enter your name.')
    .max(100, 'Use 100 characters or fewer.'),
  timezone: z
    .string()
    .max(100)
    .refine((value) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, 'Choose a valid timezone.'),
  unit_system: z.enum(['imperial', 'metric']),
  priority: z.string().trim().max(280, 'Use 280 characters or fewer.'),
  version: z.coerce.number().int().positive(),
});
export type ProfileInput = z.infer<typeof profileSchema>;
