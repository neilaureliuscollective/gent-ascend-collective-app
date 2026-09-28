import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
import { finishInput, saveFinish } from '@/domains/studio/finish';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const input = finishInput.safeParse(await mutationBody(request));
    if (!input.success) throw new IntelligenceError('Check the composition details.');
    return privateJson(await saveFinish(input.data));
  } catch (error) { return apiError(error); }
}
