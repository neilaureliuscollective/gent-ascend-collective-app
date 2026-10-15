import { z } from 'zod';
export const liveAdmission = z
  .object({
    sessionId: z.uuid(),
    conversationId: z.uuid(),
    sdp: z
      .string()
      .min(20)
      .max(24000)
      .refine((value) => value.startsWith('v=0'), 'Invalid offer'),
    saveTranscript: z.literal(true),
    includeContext: z.boolean(),
    voice: z.enum(['cedar', 'marin']).default('cedar'),
    backgroundWork: z.boolean().default(false),
    workTarget: z
      .object({
        creationId: z.uuid(),
        field: z
          .string()
          .trim()
          .regex(/^[a-z][a-zA-Z0-9-]{0,47}$/),
      })
      .strict()
      .optional(),
  })
  .strict();
export const liveEnd = z.object({ sessionId: z.uuid() }).strict();
export type LiveAdmission = z.infer<typeof liveAdmission>;
export const pilotSeconds = 120;
export type LiveEvent = {
  type: string;
  event_id?: string;
  error?: { type?: string; code?: string; event_id?: string };
  item_id?: string;
  response_id?: string;
  name?: string;
  arguments?: string;
  call_id?: string;
  transcript?: string;
  delta?: string;
  audio_end_ms?: number;
  item?: { id?: string; role?: string; content?: { text?: string; transcript?: string }[] };
  response?: {
    id?: string;
    status?: string;
    output?: { id?: string; content?: { transcript?: string; text?: string }[] }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };
};
export function readLiveEvent(raw: unknown): LiveEvent | null {
  if (typeof raw !== 'string' || raw.length > 262144) return null;
  try {
    const event: unknown = JSON.parse(raw);
    if (!event || typeof event !== 'object' || !('type' in event) || typeof event.type !== 'string')
      return null;
    return event as LiveEvent;
  } catch {
    return null;
  }
}

export const liveReview = z
  .object({ sessionId: z.uuid(), jobId: z.uuid(), approve: z.boolean() })
  .strict();
export const backgroundTask = z
  .object({
    task: z.string().trim().min(1).max(2000),
    coworker: z.enum(['athena', 'prometheus', 'apollo', 'hermes', 'themis']).nullable(),
  })
  .strict();
export type BackgroundTask = z.infer<typeof backgroundTask>;
export type LiveJob = {
  id: string;
  task: string;
  coworker: string | null;
  status: string;
  result: string;
  duration_ms: number | null;
};
