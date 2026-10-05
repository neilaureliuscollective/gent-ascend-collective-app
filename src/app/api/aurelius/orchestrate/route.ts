import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
import { orchestrationInput, prepareCapabilityDraft } from '@/domains/intelligence/orchestration';
import { IntelligenceError } from '@/domains/intelligence/service';

export const runtime='nodejs';
export const maxDuration=60;

export async function POST(request:Request){
  try {
    const parsed=orchestrationInput.safeParse(await mutationBody(request));
    if(!parsed.success) throw new IntelligenceError('Check the capability request.');
    return privateJson(await prepareCapabilityDraft(parsed.data),201);
  } catch(error) {
    return apiError(error);
  }
}
