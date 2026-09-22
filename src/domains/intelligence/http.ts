import { IntelligenceError } from './service';
export function privateJson(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } });
}
export function apiError(error: unknown) {
  return privateJson(
    {
      error:
        error instanceof IntelligenceError
          ? error.message
          : 'Aethelios could not complete this request.',
    },
    error instanceof IntelligenceError ? error.status : 503,
  );
}
export async function mutationBody(request: Request): Promise<unknown> {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  const protocol =
    request.headers.get('x-forwarded-proto') ?? new URL(request.url).protocol.slice(0, -1);
  let sameOrigin = false;
  try {
    const parsed = new URL(origin ?? '');
    sameOrigin =
      parsed.host === host &&
      parsed.protocol === protocol + ':' &&
      ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    /* malformed or opaque origin */
  }
  if (!sameOrigin) throw new IntelligenceError('Request origin could not be verified.', 403);
  if (!request.headers.get('content-type')?.includes('application/json'))
    throw new IntelligenceError('JSON required.', 415);
  const reader = request.body?.getReader();
  if (!reader) throw new IntelligenceError('Request required.');
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 32768) {
      await reader.cancel();
      throw new IntelligenceError('Request is too large.', 413);
    }
    text += decoder.decode(value, { stream: true });
  }
  try {
    return JSON.parse(text + decoder.decode());
  } catch {
    throw new IntelligenceError('Invalid request.');
  }
}
