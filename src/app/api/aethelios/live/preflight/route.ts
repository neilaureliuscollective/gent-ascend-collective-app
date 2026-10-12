import { apiError, mutationBody, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
import { preflightProbe } from '@/domains/live/preflight';
import { readLivePreflight } from '@/domains/live/preflight-service';
export const runtime = 'nodejs';
export const maxDuration = 30;
export async function GET() {
  try {
    return privateJson(await readLivePreflight());
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    const parsed = preflightProbe.safeParse(await mutationBody(request, 256));
    if (!parsed.success) throw new IntelligenceError('Explicit provider metadata check required.');
    return privateJson(await readLivePreflight(true));
  } catch (error) {
    return apiError(error);
  }
}
