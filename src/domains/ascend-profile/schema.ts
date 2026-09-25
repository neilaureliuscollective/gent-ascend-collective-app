import { z } from 'zod';

export const factKeys = ['direction','body','presence','recovery','work','character','connection','coaching','boundary'] as const;
export const factKey = z.enum(factKeys);
export const factProposal = z.object({
  key: factKey,
  value: z.string().trim().min(1).max(500),
  certainty: z.enum(['clear','needs_review']),
  reason: z.string().max(160),
});
export const proposedFacts = z.object({ facts: z.array(factProposal).max(3) });
export const baselineAnswer = z.object({
  stage: z.number().int().min(0).max(5),
  answer: z.string().trim().min(1).max(1500),
  requestId: z.uuid(),
}).strict();
export const confirmedFact = z.object({
  requestId: z.uuid(),
  key: factKey,
  value: z.string().trim().min(1).max(500).nullable(),
  expectedVersion: z.number().int().nonnegative(),
  sourceKind: z.enum(['user','ai_proposal']),
  sourceExcerpt: z.string().max(500).nullable(),
}).strict();
export type FactKey = z.infer<typeof factKey>;
export type ConfirmedFact = z.infer<typeof confirmedFact>;

export const baselineStages = [
  { prompt: 'What matters most in your life right now? What would make the next season feel well spent?', keys: ['direction'] },
  { prompt: 'How do you want to develop your body and presence? Include only what you want me to consider.', keys: ['body','presence'] },
  { prompt: 'What supports your energy and recovery today, and what tends to get in the way?', keys: ['recovery'] },
  { prompt: 'Where does your work need your best attention? What responsibility is on your mind?', keys: ['work'] },
  { prompt: 'What kind of man are you working to become, and which relationships matter most to you?', keys: ['character','connection'] },
  { prompt: 'How should I challenge or support you? Where should I stay out of the driver’s seat?', keys: ['coaching','boundary'] },
] as const;
