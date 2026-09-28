import { mutationSchema } from '@/domains/performance/schema';
import {
  readPerformance,
  savePerformance,
  explainPerformance,
} from '@/domains/performance/service';
import { privateJson, mutationBody, apiError } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
export async function GET() {
  try {
    const data = await readPerformance();
    return data.mode === 'personal'
      ? privateJson(data)
      : privateJson({ error: 'Sign in to load Performance.' }, 401);
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    const input = mutationSchema.safeParse(await mutationBody(request, 65536));
    if (!input.success) throw new IntelligenceError('Review the entries before saving.');
    return privateJson(
      input.data.kind === 'review'
        ? await explainPerformance(input.data.requestId)
        : await savePerformance(input.data),
    );
  } catch (error) {
    return apiError(error);
  }
}
