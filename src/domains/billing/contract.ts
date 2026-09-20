import type { AccessState } from '@/domains/access/policy';
export interface BillingSnapshot extends AccessState {
  personId: string;
  provider: 'stripe' | 'none';
  customerReference: string | null;
  subscriptionReference: string | null;
  synchronizedAt: string | null;
}
// Future webhook adapters verify signature, deduplicate, reconcile current provider
// state, and persist this projection. Page code never calls Stripe directly.
export interface BillingReader {
  forPerson(personId: string): Promise<BillingSnapshot>;
}
