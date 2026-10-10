import { launchBillingContract } from '@/domains/access/launch-contract';
type PriceSnapshot = {
  id: string;
  active: boolean;
  livemode: boolean;
  currency: string;
  unit_amount: number | null;
  recurring: { interval: string; interval_count: number; usage_type: string } | null;
};
/** Test-mode preparation only. A matching price still does not grant permissions or enable checkout. */
export function validateLaunchTestPrice(
  tier: keyof typeof launchBillingContract.prices,
  configuredId: string,
  price: PriceSnapshot,
): boolean {
  return (
    /^price_[A-Za-z0-9]+$/.test(configuredId) &&
    price.id === configuredId &&
    price.active &&
    !price.livemode &&
    price.currency === 'usd' &&
    price.unit_amount === launchBillingContract.prices[tier] &&
    price.recurring?.interval === 'month' &&
    price.recurring.interval_count === 1 &&
    price.recurring.usage_type === 'licensed'
  );
}
