import { z } from 'zod';
import { councilInput } from '@/domains/intelligence/validation';
export type Company = {
  id: string;
  person_id: string;
  name: string;
  brief: string;
  version: number;
  confirmed_at: string;
  created_at: string;
};
export const companyInput = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(100),
    brief: z.string().trim().max(12000),
    version: z.number().int().nonnegative(),
  })
  .strict();
export const companyChatInput = z
  .object({
    companyId: z.uuid(),
    conversationId: z.uuid(),
    requestId: z.uuid(),
    text: z.string().trim().min(1).max(6000),
    council: councilInput.optional(),
    jobId: z.uuid().optional(),
    sourceTurnId: z.uuid().optional(),
    revisionKind: z.enum(['retry', 'regenerate', 'edit']).optional(),
  })
  .strict()
  .refine((v) => Boolean(v.sourceTurnId) === Boolean(v.revisionKind));
