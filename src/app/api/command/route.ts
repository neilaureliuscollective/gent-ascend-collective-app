import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { mutationBody, privateJson, apiError } from '@/domains/intelligence/http';
import { readCommand, adoptPreparedMove } from '@/domains/command/service';
import { DailyError } from '@/domains/daily/service';
const inputSchema = z
  .object({
    ownerId: z.uuid(),
    day: z.iso.date(),
    version: z.number().int().min(0),
    source: z.enum(['review', 'goal']),
    title: z.string().trim().min(1).max(100),
    approve: z.literal(true),
  })
  .strict();
function fail(error: unknown) {
  return error instanceof DailyError
    ? privateJson({ error: error.message }, error.status)
    : apiError(error);
}
export async function GET() {
  try {
    const snapshot = await readCommand();
    return snapshot.data.mode === 'personal'
      ? privateJson(snapshot)
      : privateJson({ error: 'Sign in to load Command.' }, 401);
  } catch (error) {
    return fail(error);
  }
}
export async function POST(request: Request) {
  try {
    const input = inputSchema.safeParse(await mutationBody(request, 2048));
    if (!input.success) throw new DailyError('Confirm the exact prepared move.');
    const result = await adoptPreparedMove(input.data);
    revalidatePath('/app');
    revalidatePath('/app/progress');
    return privateJson(result);
  } catch (error) {
    return fail(error);
  }
}
