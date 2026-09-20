import 'server-only';
import { cache } from 'react';
import { currentIdentity } from '@/domains/identity/current';
export const currentPerson = cache(async () => {
  const identity = await currentIdentity();
  if (!identity) return null;
  const { data, error } = await identity.client
    .from('persons')
    .select('*')
    .eq('auth_user_id', identity.authUserId)
    .single();
  if (error || !data) throw new Error('Your personal workspace could not be loaded.');
  return data;
});
