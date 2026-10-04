import { describe, expect, it } from 'vitest';
import type Stripe from 'stripe';
import { billingConfig } from '../src/domains/billing/config';
import {
  priceTier,
  portalSafe,
  subscriptionSnapshot,
  type BillingSummary,
} from '../src/domains/billing/policy';
import { calculateCapabilities } from '../src/domains/access/policy';

import {
  billingEnvironment,
  config,
  emptyBilling,
  now,
  testPrice,
  testPortal,
  testSubscription,
} from './billing-fixtures';

describe('billing configuration and paid entitlements', () => {
  it('requires approved terms and matching test/live deployment configuration', () => {
    expect(config.enrollment).toBe(true);
    expect(
      billingConfig({ ...billingEnvironment, FOUNDING_LAUNCH_APPROVED: 'false' })?.enrollment,
    ).toBe(false);
    expect(billingConfig({ ...billingEnvironment, FOUNDING_TERMS_TEXT: '' })?.enrollment).toBe(
      false,
    );
    for (const change of [
      { APP_ENV: 'production' },
      { STRIPE_SECRET_KEY: 'sk_live_fixture' },
      { BILLING_APP_ORIGIN: 'https://example.com/path' },
      { STRIPE_PRICE_RESERVE: 'price_signature' },
      { VERCEL_ENV: 'production' },
      { SUPABASE_SERVICE_ROLE_KEY: '' },
    ])
      expect(billingConfig({ ...billingEnvironment, ...change })).toBeNull();
  });
  it('validates real amount, cadence, currency and mode instead of accepting price IDs alone', () => {
    expect(priceTier(testPrice(), config)).toBe('essential');
    for (const change of [
      { unit_amount: 1 },
      { currency: 'eur' },
      { livemode: true },
      { recurring: { interval: 'year' } },
      { billing_scheme: 'tiered' },
    ])
      expect(priceTier({ ...testPrice(), ...change } as Stripe.Price, config)).toBeNull();
  });
  it('requires safe plan changes and renewal cancellation on exactly the three founding prices', () => {
    expect(portalSafe(testPortal(), config)).toBe(true);
    const portal = testPortal();
    portal.features.subscription_cancel.mode = 'immediately';
    expect(portalSafe(portal, config)).toBe(false);
    const immediate = testPortal();
    immediate.features.subscription_update.schedule_at_period_end.conditions = [];
    expect(portalSafe(immediate, config)).toBe(false);
    const extra = testPortal();
    extra.features.subscription_update.products![0]!.prices.push('price_other');
    expect(portalSafe(extra, config)).toBe(false);
  });
  it('grants only an active paid invoice, and ignores a success redirect or scheduled cancellation', () => {
    const sub = testSubscription();
    sub.cancel_at_period_end = true;
    const snapshot = subscriptionSnapshot(sub, emptyBilling, config, false, now);
    expect(snapshot).toMatchObject({ tier: 'essential', billing: 'active', cancel: true });
    sub.latest_invoice = { id: 'in_open', status: 'open' } as Stripe.Invoice;
    expect(subscriptionSnapshot(sub, emptyBilling, config, false, now).billing).toBe('incomplete');
    sub.status = 'canceled';
    expect(subscriptionSnapshot(sub, emptyBilling, config, false, now).until).toBeNull();
  });
  it('does not expand access using a paid invoice for a different price', () => {
    const sub = testSubscription('reserve', 7499);
    const invoice = sub.latest_invoice as Stripe.Invoice;
    invoice.lines.data[0]!.pricing!.price_details!.price = 'price_essential';
    expect(subscriptionSnapshot(sub, emptyBilling, config, false, now).billing).toBe('incomplete');
  });
  it('keeps the already paid level while an upgrade invoice is awaiting payment', () => {
    const sub = testSubscription('reserve', 7499);
    sub.latest_invoice = { status: 'open' } as Stripe.Invoice;
    const previous: BillingSummary = {
      ...emptyBilling,
      subscription_id: sub.id,
      paid_tier: 'essential',
      billing_state: 'active',
      access_until: new Date(now + 86400000).toISOString(),
    };
    expect(subscriptionSnapshot(sub, previous, config, false, now)).toMatchObject({
      tier: 'essential',
      billing: 'active',
      until: previous.access_until,
    });
    expect(subscriptionSnapshot(sub, previous, config, false, now + 2 * 86400000).billing).toBe(
      'incomplete',
    );
    expect(
      subscriptionSnapshot(sub, { ...previous, subscription_id: 'sub_other' }, config, false, now)
        .billing,
    ).toBe('incomplete');
  });
  it('revokes on delinquency, refunds/disputes, unsupported items and expired paid periods', () => {
    expect(subscriptionSnapshot(testSubscription(), emptyBilling, config, true, now)).toMatchObject(
      { billing: 'unpaid', until: null },
    );
    for (const status of ['past_due', 'unpaid', 'paused', 'canceled', 'incomplete_expired']) {
      const sub = testSubscription();
      sub.status = status as Stripe.Subscription.Status;
      expect(subscriptionSnapshot(sub, emptyBilling, config, false, now).until).toBeNull();
    }
    const wrong = testSubscription();
    wrong.items.data[0]!.quantity = 2;
    expect(subscriptionSnapshot(wrong, emptyBilling, config, false, now).billing).toBe(
      'incomplete',
    );
    expect(
      subscriptionSnapshot(testSubscription(), emptyBilling, config, false, now + 40 * 86400000)
        .until,
    ).toBeNull();
  });
  it('differentiates Studio creation without selling clinical authority or removing independent invitation grants', () => {
    const state = {
      billing: 'active' as const,
      accessUntil: new Date(now + 86400000).toISOString(),
      beta: false,
    };
    expect(
      calculateCapabilities({ ...state, tier: 'essential' }, new Date(now)).has('aurelius.context'),
    ).toBe(true);
    expect(
      calculateCapabilities({ ...state, tier: 'essential' }, new Date(now)).has('studio.create'),
    ).toBe(false);
    for (const tier of ['signature', 'reserve'] as const) {
      const access = calculateCapabilities({ ...state, tier }, new Date(now));
      expect(access.has('studio.create')).toBe(true);
      expect(access.has('clinical.care')).toBe(false);
    }
    expect(
      calculateCapabilities({ ...state, tier: 'reserve', billing: 'past_due' }, new Date(now)).has(
        'studio.create',
      ),
    ).toBe(false);
    expect(
      calculateCapabilities(
        { ...state, tier: 'essential', billing: 'unpaid', beta: true },
        new Date(now),
      ).has('studio.create'),
    ).toBe(true);
  });
});

describe('payment ownership and provider mode', () => {
  it('rejects a subscription belonging to another mapped customer or provider mode', () => {
    for (const change of [{ customer: 'cus_other' }, { livemode: true }]) {
      const sub = { ...testSubscription(), ...change } as Stripe.Subscription;
      expect(subscriptionSnapshot(sub, emptyBilling, config, false, now).billing).toBe(
        'incomplete',
      );
    }
  });
  it('does not unlock access from another customer, subscription or mode invoice', () => {
    for (const change of [
      { customer: 'cus_other' },
      {
        parent: {
          type: 'subscription_details',
          subscription_details: { subscription: 'sub_other' },
        },
      },
      { livemode: true },
    ]) {
      const sub = testSubscription();
      sub.latest_invoice = {
        ...(sub.latest_invoice as Stripe.Invoice),
        ...change,
      } as Stripe.Invoice;
      expect(subscriptionSnapshot(sub, emptyBilling, config, false, now).billing).toBe(
        'incomplete',
      );
    }
  });
});
