import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
import { asIntelligence, selectConnection } from '@/domains/connections/service';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    return privateJson(await selectConnection(await mutationBody(request)));
  } catch (error) {
    return apiError(asIntelligence(error));
  }
}
