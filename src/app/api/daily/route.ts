import { revalidatePath } from 'next/cache';
import { daySchema } from '@/domains/daily/schema';
import { readDaily, saveDaily, DailyError } from '@/domains/daily/service';
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
const fail = (error: unknown) =>
  json(
    {
      error:
        error instanceof DailyError
          ? error.message
          : 'Your day could not be loaded. Please try again.',
    },
    error instanceof DailyError ? error.status : 503,
  );
export async function GET() {
  try {
    const data = await readDaily();
    return data.mode === 'preview' ? json({ error: 'Sign in to load your day.' }, 401) : json(data);
  } catch (error) {
    return fail(error);
  }
}
export async function PUT(request: Request) {
  try {
    const origin = request.headers.get('origin');
    const protocol =
      request.headers.get('x-forwarded-proto') ?? new URL(request.url).protocol.slice(0, -1);
    let validOrigin = false;
    try {
      const parsed = new URL(origin ?? '');
      validOrigin =
        ['http:', 'https:'].includes(parsed.protocol) &&
        parsed.host === request.headers.get('host') &&
        parsed.protocol === `${protocol}:`;
    } catch {
      /* invalid origin */
    }
    if (!validOrigin) throw new DailyError('Request origin could not be verified.', 403);
    if (!request.headers.get('content-type')?.includes('application/json'))
      throw new DailyError('JSON required.', 415);
    const reader = request.body?.getReader();
    if (!reader) throw new DailyError('Request required.');
    let text = '',
      size = 0;
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 8192) {
        await reader.cancel();
        throw new DailyError('Request too large.', 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    let body: unknown;
    try {
      body = JSON.parse(text + decoder.decode());
    } catch {
      throw new DailyError('Invalid JSON.');
    }
    const input = daySchema.safeParse(body);
    if (!input.success)
      throw new DailyError(
        'Review your entries: energy 1–5, sleep 0–24 hours, and up to five actions.',
      );
    const saved = await saveDaily(input.data);
    revalidatePath('/app');
    return json(saved);
  } catch (error) {
    return fail(error);
  }
}
