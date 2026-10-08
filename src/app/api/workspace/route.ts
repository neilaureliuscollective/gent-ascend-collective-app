import { apiError, privateJson } from '@/domains/intelligence/http';
import { readSavedWork } from '@/domains/workspace/service';
export async function GET() {
  try {
    return privateJson(await readSavedWork());
  } catch (e) {
    return apiError(e);
  }
}
