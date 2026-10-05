import { z } from 'zod';
export const draftKey = 'gent-direction-draft-v1';
export const draftLifetime = 24 * 60 * 60 * 1000;
export const focuses = {
  body: {
    label: 'My body',
    world: 'performance',
    href: '/experience/performance',
    action: 'Choose the time for your next training session.',
  },
  presence: {
    label: 'My presence',
    world: 'grooming',
    href: '/experience/grooming',
    action: 'Choose one grooming ritual you can repeat tomorrow.',
  },
  focus: {
    label: 'My focus',
    world: 'focus',
    href: '/app/ascend',
    action: 'Choose one important task. Give it twenty uninterrupted minutes.',
  },
} as const;
export const directionDraft = z
  .object({
    version: z.literal(1),
    id: z.uuid(),
    focus: z.enum(['body', 'presence', 'focus']),
    intention: z.string().trim().max(160),
    createdAt: z.number().int().positive(),
    timezone: z.string().min(1).max(100),
  })
  .strict();
export type DirectionDraft = z.infer<typeof directionDraft>;
export function validDraft(value: unknown, now = Date.now()): DirectionDraft | null {
  const parsed = directionDraft.safeParse(value);
  if (
    !parsed.success ||
    parsed.data.createdAt > now + 60000 ||
    now - parsed.data.createdAt > draftLifetime
  )
    return null;
  try {
    new Intl.DateTimeFormat('en', { timeZone: parsed.data.timezone });
  } catch {
    return null;
  }
  return parsed.data;
}
export const claimInput = z
  .object({
    draft: directionDraft,
    replace: z.boolean().default(false),
    expectedVersion: z.number().int().min(0).default(0),
    day: z.iso.date().optional(),
  })
  .strict();
export const claimReceipt = z.object({
  status: z.enum(['saved', 'conflict', 'day_changed']),
  id: z.uuid(),
  day: z.iso.date(),
  intention: z.string(),
  version: z.number().int(),
  focus: z.enum(['body', 'presence', 'focus']),
});
// Deliberately fixed destinations: no arbitrary next URLs or external redirects.
export const claimReturn = '/experience/world?claim=1';
