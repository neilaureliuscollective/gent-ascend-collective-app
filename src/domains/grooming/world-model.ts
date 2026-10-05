import { z } from 'zod';
import { cabinetRelations } from '@/domains/commerce/cabinet-model';
export const ritualKind = z.enum(['morning', 'evening', 'weekly']);
export const worldRitual = z.object({
  id: z.uuid(),
  kind: ritualKind,
  title: z.string(),
  steps: z.string(),
  version: z.number().int(),
  lastRecordedAt: z.string().nullable(),
  products: z
    .array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        relation: z.enum(cabinetRelations),
        note: z.string(),
      }),
    )
    .max(12)
    .default([]),
  productCount: z.number().int().nonnegative().default(0),
});
export const groomingWorldSnapshot = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('guest') }),
  z.object({
    mode: z.literal('personal'),
    ownerId: z.uuid(),
    day: z.iso.date(),
    timezone: z.string(),
    rituals: z.array(worldRitual).max(3),
    suggestedKind: ritualKind.default('morning'),
    week: z
      .array(
        z.object({
          day: z.iso.date(),
          completed: z.number().int().nonnegative(),
          notes: z.array(z.string()).max(3),
        }),
      )
      .max(7)
      .default([]),
  }),
]);
export const practiceInput = z
  .object({
    ownerId: z.uuid(),
    ritualId: z.uuid(),
    requestId: z.uuid(),
    day: z.iso.date(),
    version: z.number().int().min(1),
  })
  .strict();
export const practiceReceipt = z.object({
  id: z.uuid(),
  requestId: z.uuid(),
  ritualId: z.uuid(),
  occurredAt: z.string(),
});
export type WorldRitual = z.infer<typeof worldRitual>;
export type GroomingWorldSnapshot = z.infer<typeof groomingWorldSnapshot>;
export type PracticeInput = z.infer<typeof practiceInput>;
export type PracticeReceipt = z.infer<typeof practiceReceipt>;
export const groomingAreas = [
  {
    id: 'ritual',
    label: 'Ritual',
    eyebrow: 'THE DAILY STANDARD',
    title: 'Keep what works.',
    description: 'Return to the small practices that make your standard yours.',
  },
  {
    id: 'scan',
    label: 'Ascend Scan',
    eyebrow: 'OBSERVE WITH INTENTION',
    title: 'See your direction.',
    description: 'Three guided views. Review qualitative observations and choose what comes next.',
    href: '/app/grooming/scan',
    action: 'Begin Ascend Scan',
    note: 'Your camera opens only inside the scan, with your permission. Observations are not a diagnosis.',
  },
  {
    id: 'look',
    label: 'My Look',
    eyebrow: 'EXPLORE THE POSSIBILITIES',
    title: 'Find your expression.',
    description:
      'Explore a visual direction from your reference. Keep the look you want to discuss.',
    href: '/app/grooming/look',
    action: 'Explore My Look',
    note: 'Generated looks are concepts. They do not guarantee a service result.',
  },
  {
    id: 'professional',
    label: 'Professional',
    eyebrow: 'CARRY THE DETAILS FORWARD',
    title: 'Arrive understood.',
    description:
      'Bring a chosen brief to your grooming professional. Review the details worth keeping afterward.',
    href: '/app/grooming/professional',
    action: 'Prepare a handoff',
    note: 'You choose the text to share. A handoff does not book an appointment.',
  },
] as const;
