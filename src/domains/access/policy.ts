export const tiers = ['free', 'aurelius', 'health'] as const;
export type Tier = (typeof tiers)[number];
export type BillingState =
  'none' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'paused';
export const capabilities = [
  'daily.read',
  'daily.write',
  'profile.read',
  'profile.write',
  'goals.read',
  'goals.write',
  'progress.read',
  'aurelius.context',
  'health.navigation',
  'clinical.care',
] as const;
export type Capability = (typeof capabilities)[number];
export interface AccessState {
  tier: Tier;
  billing: BillingState;
  beta: boolean;
  founder?: boolean;
  trialEndsAt?: string | null;
  accessUntil?: string | null;
}
export function calculateCapabilities(
  state: AccessState,
  now = new Date(),
): ReadonlySet<Capability> {
  const granted = new Set<Capability>([
    'daily.read',
    'daily.write',
    'profile.read',
    'profile.write',
    'goals.read',
    'goals.write',
  ]);
  const future = (value: string | null | undefined) =>
    !!value && new Date(value).getTime() > now.getTime();
  const paid =
    (state.billing === 'active' && future(state.accessUntil)) ||
    (state.billing === 'trialing' && future(state.trialEndsAt)) ||
    (state.billing === 'canceled' && future(state.accessUntil));
  if (state.founder || state.beta || (state.tier !== 'free' && paid)) {
    granted.add('progress.read');
    granted.add('aurelius.context');
  }
  if (state.founder || (state.tier === 'health' && paid)) granted.add('health.navigation');
  // Clinical care is never derived from a membership or developer scenario.
  return granted;
}
