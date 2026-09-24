import 'server-only';
import { cache } from 'react';
import { currentIdentity } from '@/domains/identity/current';
import { currentPerson } from '@/domains/person/current';

// This is a trusted, person-bound grant. Email, membership tier, user metadata,
// and the local scenario cookie never create founder authority.
export const currentFounderAccess = cache(async (): Promise<boolean> => {
  const identity = await currentIdentity();
  const person = await currentPerson();
  if (!identity || !person) return false;
  const { data, error } = await identity.client
    .from('founder_access')
    .select('person_id')
    .eq('person_id', person.id)
    .maybeSingle();
  if (error) throw new Error('Founder access could not be verified.');
  return data?.person_id === person.id;
});
