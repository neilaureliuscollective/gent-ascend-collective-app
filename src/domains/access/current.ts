import 'server-only';
import { cookies } from 'next/headers';
import { currentIdentity } from '@/domains/identity/current';
import { currentPerson } from '@/domains/person/current';
import { parseEnvironment } from '@/platform/environment';
import { defaultScenario, founderAuthId, readScenario } from '@/domains/development/scenario';
import { calculateCapabilities, type AccessState } from './policy';
export async function currentAccess() {
  const identity = await currentIdentity();
  const person = await currentPerson();
  if (!identity || !person) return new Set<never>();
  const { data, error } = await identity.client
    .from('membership_accounts')
    .select('*')
    .eq('person_id', person.id)
    .single();
  if (error || !data) throw new Error('Membership context could not be loaded.');
  let state: AccessState = {
    tier: data.tier,
    billing: data.billing_state,
    beta: data.beta_access,
    trialEndsAt: data.trial_ends_at,
    accessUntil: data.access_until,
  };
  const env = parseEnvironment(process.env);
  if (env.harnessEnabled && identity.authUserId === founderAuthId && env.AURELIUS_DEV_TOKEN) {
    const { requireLocalHarness } = await import('@/domains/development/guard');
    await requireLocalHarness();
    const scenario =
      readScenario((await cookies()).get('aurelius-scenario')?.value, env.AURELIUS_DEV_TOKEN) ??
      defaultScenario;
    const until = new Date(Date.now() + 86400000).toISOString();
    state = {
      tier: ['founder', 'admin', 'health'].includes(scenario.membership)
        ? 'health'
        : scenario.membership === 'free'
          ? 'free'
          : 'aurelius',
      billing: scenario.billing,
      beta: ['founder', 'beta', 'admin'].includes(scenario.membership),
      trialEndsAt: until,
      accessUntil: until,
    };
  }
  return calculateCapabilities(state);
}
