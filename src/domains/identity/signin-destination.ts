import 'server-only';
import { currentAccess } from '@/domains/access/current';
import { readPilot } from '@/domains/pilot/service';
import { currentPerson } from '@/domains/person/current';
export async function signInDestination() {
  const [pilot, person] = await Promise.all([readPilot(), currentPerson()]);
  if (!person) return '/enter';
  if (pilot?.founder) return '/app/founder';
  if (pilot?.beta || person.onboarding_completed || person.priority) return '/app';
  if ((await currentAccess()).has('aurelius.context')) return '/app';
  return '/app/welcome';
}
