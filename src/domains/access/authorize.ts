import 'server-only';
import { currentIdentity } from '@/domains/identity/current';
import { currentPerson } from '@/domains/person/current';
import { currentAccess } from './current';
import type { Capability } from './policy';
export async function authorizedPerson(capability: Capability) {
  const identity = await currentIdentity();
  const person = await currentPerson();
  if (!identity || !person) return null;
  const capabilities = await currentAccess();
  if (!capabilities.has(capability)) return null;
  return { person, client: identity.client };
}
