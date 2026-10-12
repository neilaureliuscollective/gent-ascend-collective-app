import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { intelligenceSession, IntelligenceError } from '@/domains/intelligence/service';
type Session = Awaited<ReturnType<typeof intelligenceSession>>;
const base = 'https://api.openai.com/v1/realtime/calls';
export function tag(key: string, owner: string, session: string, call: string) {
  return createHmac('sha256', key)
    .update(JSON.stringify([owner, session, call]))
    .digest('hex');
}
function validTag(key: string, owner: string, session: string, call: string, signature: string) {
  const expected = Buffer.from(tag(key, owner, session, call));
  const received = Buffer.from(signature);
  return received.length === expected.length && timingSafeEqual(expected, received);
}
export async function hangup(key: string, call: string) {
  const response = await fetch(`${base}/${encodeURIComponent(call)}/hangup`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok && response.status !== 404 && response.status !== 410)
    throw new Error('Voice cleanup unavailable');
}
export async function endLive(sessionId: string, session?: Session) {
  const { client, person } = session ?? (await intelligenceSession());
  const { data, error } = await client
    .from('ai_live_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('person_id', person.id)
    .maybeSingle();
  if (error) throw new IntelligenceError('Voice cleanup could not be confirmed.', 503);
  if (!data) return;
  if (data.call_id) {
    const key = process.env.OPENAI_API_KEY;
    if (!key || !data.call_tag || !validTag(key, person.id, sessionId, data.call_id, data.call_tag))
      throw new IntelligenceError('Voice cleanup could not be verified.', 503);
    await hangup(key, data.call_id);
  }
  const finished = await client.rpc('ai_live_end', { p_id: sessionId, p_reason: 'ended' });
  if (finished.error || finished.data !== true)
    throw new IntelligenceError('Voice cleanup could not be recorded.', 503);
}

// Owner-triggered recovery after a crashed monitor. Not an independent expiry worker.
// Never take over an unexpired session in another tab or device.
export async function recoverExpiredLive(session: Session) {
  const { client, person } = session;
  const { data, error } = await client
    .from('ai_live_sessions')
    .select('id')
    .eq('person_id', person.id)
    .is('ended_at', null)
    .lte('expires_at', new Date().toISOString())
    .order('expires_at')
    .limit(11);
  if (error || !data)
    throw new IntelligenceError('Previous voice cleanup could not be checked.', 503);
  // A bounded request cannot silently admit over an unchecked backlog.
  if (data.length > 10) throw new IntelligenceError('Previous voice cleanup requires review.', 503);
  for (const row of data) await endLive(row.id, session);
}
