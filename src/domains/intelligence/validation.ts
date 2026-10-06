import { z } from 'zod';
export const councilInput = z.object({
  kind:z.enum(['specialist','table']),
  specialists:z.array(z.enum(['athena','prometheus','apollo','hermes','themis'])).min(1).max(3),
}).strict().refine(v=>new Set(v.specialists).size===v.specialists.length && (v.kind==='specialist'?v.specialists.length===1:v.specialists.length>=2),{message:'Choose one specialist or two to three Table specialists.'});
export const contextSourcesInput = z.object({ profile: z.boolean(), goals: z.boolean(), memory: z.boolean(), daily: z.boolean(), lifestyle: z.boolean() }).strict();
export const chatInput = z
  .object({
    conversationId: z.uuid(),
    requestId: z.uuid(),
    text: z.string().trim().min(1).max(6000),
    includeContext: z.boolean(),
    contextSources: contextSourcesInput.optional(),
    council: councilInput.optional(),
    sourceTurnId: z.uuid().optional(),
    revisionKind: z.enum(['retry','regenerate','edit']).optional(),
  })
  .strict().refine(v=>Boolean(v.sourceTurnId)===Boolean(v.revisionKind));
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
