import { revalidatePath } from 'next/cache';
import { completeInput, completeDailyAction } from '@/domains/daily/complete';
import { DailyError } from '@/domains/daily/service';
import { mutationBody, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const parsed = completeInput.safeParse(await mutationBody(request));
    if (!parsed.success) throw new DailyError('Choose a saved action to complete.');
    const result = await completeDailyAction(parsed.data);
    revalidatePath('/'); revalidatePath('/progress');
    return privateJson(result);
  } catch (error) {
    return privateJson({ error: error instanceof DailyError || error instanceof IntelligenceError ? error.message : 'Completion could not be confirmed.' }, error instanceof DailyError || error instanceof IntelligenceError ? error.status : 503);
  }
}
