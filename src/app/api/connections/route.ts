import { privateJson, apiError } from '@/domains/intelligence/http';
import { asIntelligence, readConnectionsBoard } from '@/domains/connections/service';
import { ConnectionError } from '@/domains/connections/errors';

export const runtime = 'nodejs';
export async function GET() {
  try {
    return privateJson(await readConnectionsBoard());
  } catch (error) {
    return apiError(asIntelligence(error instanceof ConnectionError ? error : error));
  }
}
