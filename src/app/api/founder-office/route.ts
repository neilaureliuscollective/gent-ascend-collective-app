import { readFounderOffice, prepareFounderWork } from '@/domains/founder-office/service';
import { privateJson, apiError, mutationBody } from '@/domains/intelligence/http';
export const runtime = 'nodejs';
export async function GET() {
  try {
    return privateJson(await readFounderOffice());
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    return privateJson(await prepareFounderWork(await mutationBody(request)), 201);
  } catch (error) {
    return apiError(error);
  }
}
