import { z } from 'zod';
export const eventNames = [
  'cinematic_completed',
  'preview_engaged',
  'direction_created',
  'claim_exposed',
  'claim_clicked',
  'auth_started',
  'auth_completed',
  'draft_imported',
  'onboarding_completed',
  'first_meaningful_action',
] as const;
export const funnelEvent = z
  .object({
    name: z.enum(eventNames),
    id: z.uuid(),
    journey: z.uuid(),
    elapsed: z.number().int().min(0).max(86400000),
    device: z.enum(['phone', 'wide']),
    method: z.enum(['google', 'email', 'existing']).optional(),
  })
  .strict();
