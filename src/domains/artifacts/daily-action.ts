import { z } from 'zod';
export const reviewedAction = z
  .object({
    id: z.uuid(),
    conversationId: z.uuid(),
    reviewId: z.uuid(),
    title: z.string().trim().min(1).max(100),
    day: z.iso.date(),
    version: z.number().int().min(0),
    timezone: z.string().min(1).max(100),
    confirm: z.literal(true),
  })
  .strict();
export type ReviewedActionInput = z.infer<typeof reviewedAction>;
export type ReviewedActionPreparation = {
  conversationId: string;
  reviewId: string;
  sourceTitle: string;
  day: string;
  timezone: string;
  version: number;
  receipt: { id: string; title: string; day: string; verified: boolean } | null;
};
export type ReviewedActionDraft = ReviewedActionPreparation & {
  id: string;
  title: string;
  phase: 'editing' | 'saving' | 'uncertain' | 'receipt';
  error: string;
};
