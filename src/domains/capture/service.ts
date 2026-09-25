import 'server-only';
import { authorizedPerson } from '@/domains/access/authorize';
import type { CaptureInput } from './schema';

export class CaptureError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function saveCapture(input: CaptureInput) {
  const owner = await authorizedPerson('daily.write');
  if (!owner) throw new CaptureError('Sign in to capture a thought.', 401);
  const { data, error } = await owner.client.from('life_captures')
    .insert({ ...input, person_id: owner.person.id }).select('*').single();
  if (error?.code === '23505') {
    const existing = await owner.client.from('life_captures').select('*')
      .eq('id', input.id).eq('person_id', owner.person.id).maybeSingle();
    if (existing.data && existing.data.content === input.content && existing.data.kind === input.kind) return existing.data;
    throw new CaptureError('This capture ID is already used. Reload before retrying.', 409);
  }
  if (error || !data) throw new CaptureError('Capture could not be confirmed. Keep your draft and retry.', 503);
  return data;
}

export async function listCaptures() {
  const owner = await authorizedPerson('daily.read');
  if (!owner) throw new CaptureError('Sign in to view your captures.', 401);
  const { data, error } = await owner.client.from('life_captures').select('*')
    .eq('person_id', owner.person.id).eq('status', 'inbox')
    .order('created_at', { ascending: false }).limit(50);
  if (error) throw new CaptureError('Captures could not be loaded.', 503);
  return data ?? [];
}
