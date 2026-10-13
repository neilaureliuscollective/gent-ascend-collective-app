import { ConnectionError } from './errors';

export async function providerJson(
  url: string,
  init: RequestInit & { maxBytes?: number } = {},
): Promise<unknown> {
  const { maxBytes = 200000, ...request } = init;
  let response: Response;
  try {
    response = await fetch(url, {
      ...request,
      redirect: 'error',
      cache: 'no-store',
      signal: request.signal ?? AbortSignal.timeout(10000),
    });
  } catch {
    throw new ConnectionError('The provider could not be reached.', 503, 'provider');
  }
  const reader = response.body?.getReader();
  if (!reader) throw new ConnectionError('The provider response was empty.', 503, 'provider');
  const decoder = new TextDecoder();
  let text = '';
  let bytes = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.length;
    if (bytes > maxBytes) {
      await reader.cancel();
      throw new ConnectionError('The provider response was too large.', 503, 'provider');
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  if (!response.ok) {
    if (response.status === 401)
      throw new ConnectionError('The provider rejected this credential.', 401, 'revoked');
    if (response.status === 403)
      throw new ConnectionError('The provider denied this request.', 403, 'denied');
    if (response.status === 404)
      throw new ConnectionError('The selected resource is no longer available.', 404, 'degraded');
    throw new ConnectionError('The provider could not complete this request.', 503, 'provider');
  }
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ConnectionError('The provider response could not be read.', 503, 'provider');
  }
}

export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
