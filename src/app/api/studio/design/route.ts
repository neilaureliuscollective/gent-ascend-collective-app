import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
import { createDesign, designCreateInput, designSaveInput, saveDesign } from '@/domains/studio/design-service';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const body = await mutationBody(request, 524288);
    const created = designCreateInput.safeParse(body);
    if (created.success) return privateJson(await createDesign(created.data), 201);
    const input = designSaveInput.safeParse(body);
    if (!input.success) throw new IntelligenceError('Check the design document.');
    return privateJson(await saveDesign(input.data));
  } catch (error) {
    return apiError(error);
  }
}
