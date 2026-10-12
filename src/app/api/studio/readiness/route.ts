import { apiError, privateJson } from '@/domains/intelligence/http';
import { studioReadiness } from '@/domains/studio/readiness-service';
export const runtime = 'nodejs';
export async function GET() {
  try {
    return privateJson(await studioReadiness());
  } catch (error) {
    return apiError(error);
  }
}
