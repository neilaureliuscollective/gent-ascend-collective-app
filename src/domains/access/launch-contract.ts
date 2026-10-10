import { calculateCapabilities, type AccessState, type Capability } from './policy';
/** Capability names outlive commercial tier names. Only server-resolved state is an input. */
export type ProductCapability =
  Capability | 'architect.workshop' | 'architect.agent' | 'health.education';
export function resolveProductCapabilities(
  state: AccessState,
  now = new Date(),
): ReadonlySet<ProductCapability> {
  const grants = new Set<ProductCapability>(calculateCapabilities(state, now));
  // These tools are free previews, with no provider execution or private persistence.
  grants.add('architect.workshop');
  grants.add('health.education');
  // No Architect agent grant until a verified billing/add-on snapshot and usage ledger exist.
  return grants;
}
export const launchBillingContract = {
  currency: 'usd',
  interval: 'month',
  prices: { essential: 1999, signature: 4999, architect: 12900 },
  legacy: ['aurelius', 'health', 'reserve'],
  requiredBeforeArchitectEnrollment: [
    'additive database tier contract',
    'verified test price',
    'signed webhook reconciliation',
    'atomic job reservation',
    'real-auth acceptance',
    'founder launch approval',
  ],
} as const;
