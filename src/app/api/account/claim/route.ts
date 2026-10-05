import { mutationBody, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
import { DailyError } from '@/domains/daily/service';
import { claimDirection } from '@/domains/onboarding/service';
import { revalidatePath } from 'next/cache';
export async function POST(request: Request) {
  try {
    const result = await claimDirection(await mutationBody(request, 2048));
    if (result.status === 'saved') revalidatePath('/app');
    return privateJson(result);
  } catch (error) {
    const known = error instanceof IntelligenceError || error instanceof DailyError;
    return privateJson(
      { error: known ? error.message : 'Your draft could not be saved. Retry shortly.' },
      known ? error.status : 503,
    );
  }
}
