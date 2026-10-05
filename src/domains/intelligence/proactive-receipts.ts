import 'server-only';
import { intelligenceSession, IntelligenceError } from './service';

export type ProactiveReceipt = {
  signal_key: string;
  disposition: 'opened' | 'dismissed';
  handled_at: string;
  expires_at: string;
};

export async function readProactiveReceipts(now = new Date()): Promise<ProactiveReceipt[]> {
  const { client, person } = await intelligenceSession();
  const result = await client
    .from('proactive_signal_receipts')
    .select('signal_key,disposition,handled_at,expires_at')
    .eq('person_id', person.id)
    .gt('expires_at', now.toISOString())
    .order('handled_at', { ascending: false })
    .limit(100);
  if (result.error) throw new IntelligenceError('Ahead history could not be loaded.', 503);
  return result.data ?? [];
}

export async function markProactiveReceipt(input: {
  signalKey: string;
  disposition: 'opened' | 'dismissed';
  expiresAt: string;
}) {
  const { client, person } = await intelligenceSession();
  const expires = new Date(input.expiresAt);
  if (!Number.isFinite(expires.getTime()) || expires <= new Date())
    throw new IntelligenceError('This Ahead signal is no longer current.', 409);
  const result = await client
    .from('proactive_signal_receipts')
    .upsert(
      {
        person_id: person.id,
        signal_key: input.signalKey,
        disposition: input.disposition,
        handled_at: new Date().toISOString(),
        expires_at: expires.toISOString(),
      },
      { onConflict: 'person_id,signal_key' },
    )
    .select('signal_key,disposition,handled_at,expires_at')
    .single();
  if (result.error || !result.data) throw new IntelligenceError('Ahead status could not be saved.', 503);
  return result.data as ProactiveReceipt;
}
