import { revalidatePath } from 'next/cache';
import { mutationBody, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
import { DailyError } from '@/domains/daily/service';
import { priorityInput } from '@/domains/daily/world-priority-model';
import { readWorldPriority, saveWorldPriority } from '@/domains/daily/world-priority';

function fail(error: unknown) {
  const known = error instanceof DailyError || error instanceof IntelligenceError;
  return privateJson(
    { error: known ? error.message : 'Your priority is unavailable. Try again.' },
    known ? error.status : 503,
  );
}
export async function GET() {
  try {
    return privateJson(await readWorldPriority());
  } catch (error) {
    return fail(error);
  }
}
export async function PUT(request: Request) {
  try {
    const input = priorityInput.safeParse(await mutationBody(request, 2048));
    if (!input.success)
      throw new DailyError(
        'Write a priority of 1–160 characters and, if included, a next move of 1–100 characters.',
      );
    const result = await saveWorldPriority(input.data);
    revalidatePath('/app');
    return privateJson(result);
  } catch (error) {
    return fail(error);
  }
}
