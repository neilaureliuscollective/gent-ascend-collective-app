import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
import { compositionSaveInput, saveComposition } from '@/domains/studio/composition-service';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const input = compositionSaveInput.safeParse(await mutationBody(request, 262144));
    if (!input.success) throw new IntelligenceError('Check the film composition.');
    return privateJson(await saveComposition(input.data));
  } catch (error) {
    return apiError(error);
  }
}
