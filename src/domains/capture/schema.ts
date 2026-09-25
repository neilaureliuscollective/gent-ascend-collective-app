import { z } from 'zod';

export const captureSchema = z.object({
  id: z.uuid(),
  content: z.string().trim().min(1).max(2000),
  kind: z.enum(['thought', 'idea', 'task', 'decision']),
}).strict();

export type CaptureInput = z.infer<typeof captureSchema>;
