import { mutationBody, privateJson } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
import { DailyError } from '@/domains/daily/service';
import { mutationSchema } from '@/domains/daily-command/model';
import { readCommand, saveCommand } from '@/domains/daily-command/service';
function fail(error: unknown) {
  const known = error instanceof DailyError || error instanceof IntelligenceError;
  return privateJson(
    { error: known ? error.message : 'Daily Command is temporarily unavailable.' },
    known ? error.status : 503,
  );
}
export async function GET() {
  try {
    const data = await readCommand();
    return data.mode === 'preview'
      ? privateJson({ error: 'Sign in to load your command.' }, 401)
      : privateJson(data);
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: Request) {
  try {
    const parsed = mutationSchema.safeParse(await mutationBody(request, 4096));
    if (!parsed.success) throw new DailyError('Review your command entries.');
    return privateJson(await saveCommand(parsed.data));
  } catch (e) {
    return fail(e);
  }
}
