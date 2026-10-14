import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
import { freezeDesign } from '@/domains/studio/design-service';
import { z } from 'zod';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const input = z.object({ designId: z.uuid() }).strict().safeParse(await mutationBody(request));
    if (!input.success) throw new IntelligenceError('Check the design revision.');
    return privateJson(await freezeDesign(input.data.designId));
  } catch (error) {
    return apiError(error);
  }
}
