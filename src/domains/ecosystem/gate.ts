import 'server-only';
import { accountConfig } from '@/domains/onboarding/config';
import { billingConfig } from '@/domains/billing/config';
import { currentIdentity } from '@/domains/identity/current';
import { registrationConfig } from '@/domains/identity/registration-config';
import type { JourneyGate } from './selection';

export async function ecosystemJourneyGate(
  env: Record<string, string | undefined> = process.env,
): Promise<JourneyGate> {
  return {
    signedIn: !!(await currentIdentity().catch(() => null)),
    registrationOpen: !!registrationConfig(env),
    claimReady: !!accountConfig(env),
    enrollmentOpen: billingConfig(env)?.enrollment === true,
  };
}
