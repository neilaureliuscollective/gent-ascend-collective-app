import { z } from 'zod';
export const coworkerId = z.enum(['athena', 'prometheus', 'apollo', 'hermes', 'themis']);
export const coworkerProposal = z
  .object({
    id: z.uuid(),
    conversationId: z.uuid(),
    operation: z.literal('visual.review'),
    prompt: z.string().trim().min(3).max(3000),
    coworker: coworkerId,
    contextScope: z.enum(['task-only', 'selected-part']),
  })
  .strict();
export const reviewSchema = z
  .object({
    kind: z.literal('review'),
    basis: z.literal('coworker'),
    title: z.string().min(1).max(100),
    summary: z.string().min(1).max(600),
    coworker: coworkerId,
    text: z.string().trim().min(1).max(16000),
    contextScope: z.enum(['task-only', 'selected-part']),
    sourceArtifactId: z.uuid().nullable(),
    sourcePartId: z
      .string()
      .regex(/^[a-z][a-z0-9_-]{0,31}$/)
      .nullable(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (
      (data.contextScope === 'selected-part' && (!data.sourceArtifactId || !data.sourcePartId)) ||
      (data.contextScope === 'task-only' &&
        (data.sourceArtifactId !== null || data.sourcePartId !== null))
    )
      ctx.addIssue({ code: 'custom', message: 'Review context mismatch' });
  });
