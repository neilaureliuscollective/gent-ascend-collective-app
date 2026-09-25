import 'server-only';
import { authorizedPerson } from '@/domains/access/authorize';
import type { ConfirmedFact } from './schema';

export class ProfileStateError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export async function readAscendProfile() {
  const owner = await authorizedPerson('profile.read');
  if (!owner) throw new ProfileStateError('Sign in to see your Ascend Profile.',401);
  const result = await owner.client.from('ascend_profile_facts').select('*').eq('person_id',owner.person.id);
  if (result.error) throw new ProfileStateError('Your profile could not be loaded.',503);
  return result.data ?? [];
}
export async function confirmAscendFact(input: ConfirmedFact) {
  const owner = await authorizedPerson('profile.write');
  if (!owner) throw new ProfileStateError('Sign in to save your profile.',401);
  const result = await owner.client.rpc('ascend_profile_confirm',{
    p_request: input.requestId, p_key: input.key, p_value: input.value,
    p_expected_version: input.expectedVersion, p_source_kind: input.sourceKind,
    p_excerpt: input.sourceExcerpt,
  });
  if (result.error?.code === '40001') throw new ProfileStateError('This detail changed in another session. Reload before confirming it.',409);
  if (result.error?.code === '23505') throw new ProfileStateError('This save request has already been used.',409);
  if (result.error) throw new ProfileStateError('The change was not confirmed. Reload to check the saved profile.',503);
  return { key: input.key, version: result.data, value: input.value };
}
