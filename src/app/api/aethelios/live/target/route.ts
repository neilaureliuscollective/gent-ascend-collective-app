import { IntelligenceError } from '@/domains/intelligence/service';
import { mutationBody, privateJson, apiError } from '@/domains/intelligence/http';
import { verifySpokenWorkTarget } from '@/domains/live/spoken-target';
import { z } from 'zod';

export const runtime = 'nodejs';

const spokenTargetInput = z
  .object({
    sessionId: z.uuid(),
    workTarget: z
      .object({
        creationId: z.uuid(),
        field: z
          .string()
          .trim()
          .regex(/^[a-z][a-zA-Z0-9-]{0,47}$/),
      })
      .strict()
      .nullable(),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const parsed = spokenTargetInput.safeParse(await mutationBody(request, 2048));
    if (!parsed.success) throw new IntelligenceError('Invalid spoken work target.');
    return privateJson(await verifySpokenWorkTarget(parsed.data));
  } catch (error) {
    return apiError(error);
  }
}
