import 'server-only';
import { z } from 'zod';
import { liveStartup } from './protocol';
const reply = z.object({
  session: z.object({ id: z.string().min(1).max(200) }),
  transport: z.object({
    type: z.literal('webrtc'),
    sdp: z.string().min(20).max(65536).startsWith('v=0'),
  }),
});
/** Evaluation adapter: invoked by an authorized harness, never auto-selected by the public pilot. */
export async function createGPTLive(
  key: string,
  sdp: string,
  config: Parameters<typeof liveStartup>[0],
  request: typeof fetch = fetch,
) {
  if (!sdp.startsWith('v=0') || sdp.length > 24000) throw new Error('Invalid Live SDP offer');
  const response = await request('https://api.openai.com/v1/live/sessions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ session: liveStartup(config), transport: { type: 'webrtc', sdp } }),
    signal: AbortSignal.timeout(20000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('GPT-Live admission unavailable');
  const body: unknown = await response.json();
  const parsed = reply.safeParse(body);
  if (!parsed.success) {
    const known = z
      .object({ session: z.object({ id: z.string().min(1).max(200) }) })
      .safeParse(body);
    if (known.success) await hangupGPTLive(key, known.data.session.id, request);
    throw new Error('GPT-Live SDP response invalid');
  }
  return parsed.data;
}
export function liveSidebandURL(sessionId: string) {
  if (!sessionId || sessionId.length > 200) throw new Error('Invalid session');
  return 'wss://api.openai.com/v1/live/sessions/' + encodeURIComponent(sessionId) + '/attach';
}
export async function hangupGPTLive(key: string, sessionId: string, request: typeof fetch = fetch) {
  if (!sessionId || sessionId.length > 200) throw new Error('Invalid session');
  const response = await request(
    'https://api.openai.com/v1/live/sessions/' + encodeURIComponent(sessionId) + '/hangup',
    {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key },
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    },
  );
  if (!response.ok && response.status !== 404 && response.status !== 410)
    throw new Error('Live cleanup unconfirmed');
}
