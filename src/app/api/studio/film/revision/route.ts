import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
import { freezeComposition } from '@/domains/studio/composition-service';
import { z } from 'zod';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const input = z.object({ compositionId: z.uuid() }).strict().safeParse(await mutationBody(request));
    if (!input.success) throw new IntelligenceError('Check the film revision.');
    return privateJson(await freezeComposition(input.data.compositionId));
  } catch (error) {
    return apiError(error);
  }
}
