import type { AccessState } from '@/domains/access/policy';
export interface BillingSnapshot extends AccessState {
  personId: string;
  provider: 'stripe' | 'none';
  customerReference: string | null;
  subscriptionReference: string | null;
  synchronizedAt: string | null;
}
// The implemented provider adapter persists a verified projection through service-only
// control RPCs. Optional readers must preserve session ownership; this type grants no access.
export interface BillingReader {
  forPerson(personId: string): Promise<BillingSnapshot>;
}
