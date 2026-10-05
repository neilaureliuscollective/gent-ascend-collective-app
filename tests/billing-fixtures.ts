import type Stripe from 'stripe';
import { billingConfig } from '../src/domains/billing/config';
import type { BillingSummary } from '../src/domains/billing/policy';
export const billingEnvironment = {
  APP_ENV: 'local',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'synthetic-public-key',
  STRIPE_SECRET_KEY: 'sk_test_fixture',
  STRIPE_WEBHOOK_SECRET: 'whsec_fixture',
  SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-key',
  BILLING_APP_ORIGIN: 'http://127.0.0.1:3100',
  STRIPE_PRICE_ESSENTIAL: 'price_essential',
  STRIPE_PRICE_SIGNATURE: 'price_signature',
  STRIPE_PRICE_RESERVE: 'price_reserve',
  STRIPE_PORTAL_CONFIGURATION: 'bpc_fixture',
  STRIPE_PORTAL_RECOVERY_CONFIGURATION: 'bpc_recovery',
  BILLING_TAX_MODE: 'automatic',
  MEMBERSHIP_SUPPORT_EMAIL: 'support@example.test',
  STRIPE_CHECKOUT_ENABLED: 'true',
  FOUNDING_LAUNCH_APPROVED: 'true',
  FOUNDING_TERMS_VERSION: 'test-v1',
  FOUNDING_TERMS_TEXT: 'Synthetic terms for tests only. '.repeat(8),
};
export const config = billingConfig(billingEnvironment)!;
export function testPrice(tier = 'essential', amount = 1999) {
  return {
    id: `price_${tier}`,
    active: true,
    unit_amount: amount,
    currency: 'usd',
    type: 'recurring',
    recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' },
    billing_scheme: 'per_unit',
    livemode: false,
    product: 'prod_membership',
  } as Stripe.Price;
}
export function testPortal() {
  return {
    active: true,
    livemode: false,
    features: {
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: 'at_period_end', proration_behavior: 'none' },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ['price'],
        proration_behavior: 'always_invoice',
        billing_cycle_anchor: 'unchanged',
        products: [
          {
            product: 'prod_membership',
            prices: Object.values(config.prices),
            adjustable_quantity: { enabled: false },
          },
        ],
        schedule_at_period_end: { conditions: [{ type: 'decreasing_item_amount' }] },
      },
    },
  } as Stripe.BillingPortal.Configuration;
}
export const emptyBilling: BillingSummary = {
  person_id: '00000000-0000-4000-8000-000000000001',
  customer_id: 'cus_owner',
  subscription_id: null,
  paid_tier: null,
  provider_status: 'none',
  billing_state: 'none',
  access_until: null,
  cancel_at_period_end: false,
  synchronized_at: null,
  payment_hold: false,
};
export const now = Date.parse('2026-10-02T12:00:00Z');
export function testSubscription(tier = 'essential', amount = 1999) {
  return {
    id: 'sub_owner',
    created: 1,
    customer: 'cus_owner',
    livemode: false,
    status: 'active',
    collection_method: 'charge_automatically',
    metadata: { gent_ascend: 'founding-v1' },
    cancel_at_period_end: false,
    latest_invoice: {
      id: 'in_paid',
      customer: 'cus_owner',
      livemode: false,
      parent: { type: 'subscription_details', subscription_details: { subscription: 'sub_owner' } },
      status: 'paid',
      lines: {
        has_more: false,
        data: [{ amount, pricing: { price_details: { price: `price_${tier}` } } }],
      },
    },
    items: {
      has_more: false,
      data: [
        {
          id: 'si_owner',
          quantity: 1,
          price: testPrice(tier, amount),
          current_period_end: now / 1000 + 86400 * 30,
        },
      ],
    },
  } as unknown as Stripe.Subscription;
}
