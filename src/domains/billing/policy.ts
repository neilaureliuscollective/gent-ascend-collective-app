import type Stripe from 'stripe';
import { foundingPlans, type FoundingTier } from './founding-catalog';
import type { BillingConfig } from './config';

export type BillingSummary = {
  person_id: string;
  customer_id: string | null;
  subscription_id: string | null;
  paid_tier: FoundingTier | null;
  provider_status: string;
  billing_state: string;
  access_until: string | null;
  cancel_at_period_end: boolean;
  synchronized_at: string | null;
  payment_hold: boolean;
};
export type BillingSnapshot = {
  subscription: string | null;
  tier: FoundingTier | null;
  status: string;
  billing:
    'none' | 'active' | 'incomplete' | 'past_due' | 'unpaid' | 'canceled' | 'paused' | 'trialing';
  until: string | null;
  cancel: boolean;
  hold: boolean;
};

export function priceTier(price: Stripe.Price, config: BillingConfig): FoundingTier | null {
  return (
    foundingPlans.find(
      (plan) =>
        config.prices[plan.id] === price.id &&
        price.unit_amount === plan.monthlyCents &&
        price.currency === 'usd' &&
        price.type === 'recurring' &&
        price.recurring?.interval === 'month' &&
        price.recurring.interval_count === 1 &&
        price.recurring.usage_type === 'licensed' &&
        price.billing_scheme === 'per_unit' &&
        price.livemode === config.live,
    )?.id ?? null
  );
}

/** Current provider state, retrieved under a per-person lease, replaces event delivery order. */
export function subscriptionSnapshot(
  sub: Stripe.Subscription | null,
  previous: BillingSummary,
  config: BillingConfig,
  hold: boolean,
  now = Date.now(),
): BillingSnapshot {
  const empty: BillingSnapshot = {
    subscription: sub?.id ?? null,
    tier: null,
    status: sub?.status ?? 'none',
    billing: 'none',
    until: null,
    cancel: sub?.cancel_at_period_end ?? false,
    hold,
  };
  if (!sub) return { ...empty, billing: hold ? 'unpaid' : 'none' };
  const item = sub.items.data.length === 1 ? sub.items.data[0] : null;
  const tier =
    item && item.quantity === 1 && sub.collection_method === 'charge_automatically'
      ? priceTier(item.price, config)
      : null;
  if (!tier || !item || sub.items.has_more) return { ...empty, billing: 'incomplete' };
  if (hold) return { ...empty, tier, billing: 'unpaid' };
  if (sub.status !== 'active') {
    const billing: BillingSnapshot['billing'] =
      sub.status === 'past_due'
        ? 'past_due'
        : sub.status === 'unpaid'
          ? 'unpaid'
          : sub.status === 'canceled'
            ? 'canceled'
            : sub.status === 'paused'
              ? 'paused'
              : sub.status === 'trialing'
                ? 'trialing'
                : 'incomplete';
    return { ...empty, tier, billing, until: null };
  }
  const invoice = typeof sub.latest_invoice === 'object' ? sub.latest_invoice : null;
  const invoiceMatchesPrice =
    !!invoice?.lines &&
    !invoice.lines.has_more &&
    invoice.lines.data.some((line) => {
      const price = line.pricing?.price_details?.price;
      return (typeof price === 'string' ? price : price?.id) === item.price.id && line.amount >= 0;
    });
  if (invoice?.status === 'paid' && invoiceMatchesPrice && item.current_period_end * 1000 > now) {
    return {
      ...empty,
      tier,
      billing: 'active',
      until: new Date(item.current_period_end * 1000).toISOString(),
    };
  }
  // A portal upgrade can change Stripe's price while its invoice is still open.
  // Keep only the already-paid entitlement, never expand it on an unpaid invoice.
  if (
    previous.subscription_id === sub.id &&
    previous.billing_state === 'active' &&
    previous.paid_tier &&
    previous.access_until &&
    Date.parse(previous.access_until) > now &&
    !previous.payment_hold
  ) {
    return { ...empty, tier: previous.paid_tier, billing: 'active', until: previous.access_until };
  }
  return { ...empty, tier, billing: 'incomplete' };
}

export function portalSafe(portal: Stripe.BillingPortal.Configuration, config: BillingConfig) {
  const update = portal.features.subscription_update;
  const prices = update.products?.flatMap((product) => product.prices) ?? [];
  return (
    portal.active &&
    portal.livemode === config.live &&
    portal.features.payment_method_update.enabled &&
    portal.features.invoice_history.enabled &&
    portal.features.subscription_cancel.enabled &&
    portal.features.subscription_cancel.mode === 'at_period_end' &&
    portal.features.subscription_cancel.proration_behavior === 'none' &&
    update.products?.length === 1 &&
    update.enabled &&
    update.default_allowed_updates.length === 1 &&
    update.default_allowed_updates[0] === 'price' &&
    update.proration_behavior === 'always_invoice' &&
    update.billing_cycle_anchor !== 'now' &&
    update.schedule_at_period_end.conditions.some(
      (condition) => condition.type === 'decreasing_item_amount',
    ) &&
    prices.length === 3 &&
    new Set(prices).size === 3 &&
    Object.values(config.prices).every((price) => prices.includes(price)) &&
    update.products?.every((product) => !product.adjustable_quantity.enabled)
  );
}

export function billingPaidActive(billing: BillingSummary | null, now = Date.now()) {
  return (
    !!billing &&
    billing.billing_state === 'active' &&
    !!billing.access_until &&
    Date.parse(billing.access_until) > now &&
    !billing.payment_hold
  );
}
