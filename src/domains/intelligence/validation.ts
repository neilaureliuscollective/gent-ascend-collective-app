import { z } from 'zod';
export const chatInput = z
  .object({
    conversationId: z.uuid(),
    requestId: z.uuid(),
    text: z.string().trim().min(1).max(6000),
    includeContext: z.boolean(),
  })
  .strict();
export const memoryInput = z
  .object({
    id: z.uuid(),
    content: z.string().trim().min(1).max(500),
    kind: z.enum(['preference', 'fact']),
    version: z.number().int().nonnegative(),
  })
  .strict();
export const memoryDeleteInput = z
  .object({ id: z.uuid(), version: z.number().int().positive() })
  .strict();
export const feedbackInput = z
  .object({ id: z.uuid(), feedback: z.enum(['helpful', 'needs_work']) })
  .strict();
export const idInput = z.uuid();
export const aiConfigSchema = z.object({
  OPENAI_API_KEY: z.string().min(1).optional(),
  AURELIUS_AI_MODEL: z
    .string()
    .regex(/^[a-z0-9][a-z0-9._-]*$/)
    .default('gpt-6-astra'),
});
