import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
import { cancelRender, renderStartInput, startRender } from '@/domains/studio/composition-service';
import { z } from 'zod';
export const runtime = 'nodejs';
export const maxDuration = 180;
export async function POST(request: Request) {
  try {
    const body = await mutationBody(request);
    const cancel = z.object({ id: z.uuid(), action: z.literal('cancel') }).strict().safeParse(body);
    if (cancel.success) return privateJson(await cancelRender(cancel.data.id));
    const input = renderStartInput.safeParse(body);
    if (!input.success) throw new IntelligenceError('Check the film render request.');
    return privateJson(await startRender(input.data, process.env.STUDIO_RENDER_WORKER !== 'true'));
  } catch (error) {
    return apiError(error);
  }
}
