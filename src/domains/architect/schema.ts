import { z } from 'zod';
export const webProjectSchema = z
  .object({
    version: z.literal(1),
    name: z.string().trim().min(1).max(80),
    brief: z.string().max(2000),
    html: z.string().max(40000),
    css: z.string().max(40000),
  })
  .strict();
export const architectInput = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('save'),
      projectId: z.uuid(),
      versionId: z.uuid(),
      expected: z.number().int().min(0).max(99),
      content: webProjectSchema,
    })
    .strict(),
  z.object({ action: z.literal('delete'), projectId: z.uuid() }).strict(),
  z
    .object({
      action: z.literal('generate'),
      projectId: z.uuid(),
      requestId: z.uuid(),
      expected: z.number().int().min(1).max(100),
      instruction: z.string().trim().min(1).max(3000),
      consent: z.literal(true),
    })
    .strict(),
]);
export function architectModel(env: Record<string, string | undefined>) {
  return env.ARCHITECT_AI_ENABLED === 'true' &&
    env.ARCHITECT_AI_BUDGET_APPROVED === 'true' &&
    env.OPENAI_API_KEY &&
    ['gpt-4.1-mini', 'gpt-4.1'].includes(env.ARCHITECT_AI_MODEL ?? '')
    ? env.ARCHITECT_AI_MODEL!
    : null;
}
