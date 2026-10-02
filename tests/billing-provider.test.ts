import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import type Stripe from 'stripe';
import {
  billingEnvironment,
  emptyBilling,
  now,
  testPrice,
  testPortal,
  testSubscription,
} from './billing-fixtures';

const fake = vi.hoisted(() => ({
  rpc: vi.fn(),
  owner: vi.fn(),
  identity: vi.fn(),
  createCustomer: vi.fn(),
  prices: vi.fn(),
  portalConfig: vi.fn(),
  list: vi.fn(),
  checkout: vi.fn(),
  retrieveCheckout: vi.fn(),
  portal: vi.fn(),
  charge: vi.fn(),
  dispute: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/domains/person/current', () => ({ currentPerson: fake.owner }));
vi.mock('@/domains/identity/current', () => ({ currentIdentity: fake.identity }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc: fake.rpc }) }));
vi.mock('stripe', async (original) => {
  const actual = await original<typeof import('stripe')>();
  const sdk = new actual.default('sk_test_fixture');
  return {
    default: class {
      webhooks = sdk.webhooks;
      customers = { create: fake.createCustomer };
      prices = { retrieve: fake.prices };
      subscriptions = { list: fake.list };
      checkout = { sessions: { create: fake.checkout, retrieve: fake.retrieveCheckout } };
      billingPortal = {
        configurations: { retrieve: fake.portalConfig },
        sessions: { create: fake.portal },
      };
      charges = { retrieve: fake.charge };
      disputes = { retrieve: fake.dispute };
    },
  };
});
import {
  handleWebhook,
  startCheckout,
  openPortal,
  refreshBilling,
} from '../src/domains/billing/provider';
import { POST } from '../src/app/api/billing/route';

let summary = { ...emptyBilling, customer_id: null as string | null };
let attempt: Record<string, unknown> | null = null;
let held = false;
let sub: Stripe.Subscription | null = null;
const seen = new Set<string>();
let holds: Record<string, boolean> = {};
const ownerClient = {
  auth: {
    getUser: async () => ({
      data: {
        user: {
          id: 'synthetic-owner',
          email_confirmed_at: '2026-10-02T00:00:00Z',
          is_anonymous: false,
        },
      },
      error: null,
    }),
  },
  from: vi.fn(() => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: summary, error: null }) }) }),
  })),
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Date, 'now').mockReturnValue(now);
  for (const [key, value] of Object.entries(billingEnvironment)) vi.stubEnv(key, value);
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'synthetic-public-key');
  summary = { ...emptyBilling, customer_id: null };
  attempt = null;
  held = false;
  sub = null;
  seen.clear();
  holds = {};
  fake.owner.mockResolvedValue({ id: emptyBilling.person_id });
  fake.identity.mockResolvedValue({ authUserId: 'synthetic-owner', client: ownerClient });
  fake.prices.mockImplementation(async (id: string) =>
    testPrice(
      id.replace('price_', ''),
      id === 'price_essential' ? 1999 : id === 'price_signature' ? 4999 : 7499,
    ),
  );
  fake.portalConfig.mockImplementation(async (id: string) => {
    const portal = testPortal();
    if (id === 'bpc_recovery') portal.features.subscription_update.enabled = false;
    return portal;
  });
  fake.createCustomer.mockResolvedValue({ id: 'cus_owner' });
  fake.checkout.mockResolvedValue({
    id: 'cs_owner',
    url: 'https://checkout.stripe.com/c/pay/synthetic',
  });
  fake.retrieveCheckout.mockResolvedValue({
    status: 'open',
    url: 'https://checkout.stripe.com/c/pay/synthetic',
  });
  fake.portal.mockResolvedValue({ url: 'https://billing.stripe.com/p/session/synthetic' });
  fake.list.mockImplementation(async () => ({ data: sub ? [sub] : [], has_more: false }));
  fake.rpc.mockImplementation(
    async (_name: string, args: { p_command: string; p_payload: Record<string, unknown> }) => {
      const payload = args.p_payload;
      switch (args.p_command) {
        case 'acquire':
          if (held) return { error: { code: '55P03' } };
          held = true;
          return { data: { profile: { ...summary }, attempt, holds: { ...holds } }, error: null };
        case 'release':
          held = false;
          break;
        case 'lookup':
          return {
            data: summary.customer_id === payload.customer ? { person: summary.person_id } : null,
            error: null,
          };
        case 'bind':
          summary.customer_id = String(payload.customer);
          break;
        case 'reserve':
          attempt = { ...payload };
          break;
        case 'sync':
          if (payload.event && seen.has(String(payload.event)))
            return { data: { duplicate: true }, error: null };
          if (payload.event) seen.add(String(payload.event));
          if (payload.holdKey) holds[String(payload.holdKey)] = Boolean(payload.holdValue);
          summary = {
            ...summary,
            subscription_id: payload.subscription as string | null,
            paid_tier: payload.tier as typeof summary.paid_tier,
            billing_state: String(payload.billing),
            provider_status: String(payload.status),
            access_until: payload.until as string | null,
            payment_hold: Boolean(payload.hold),
          };
          break;
      }
      return { data: {}, error: null };
    },
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
function event(type: string, object: unknown, id = 'evt_fixture') {
  const raw = JSON.stringify({ id, type, livemode: false, data: { object } });
  const timestamp = Math.floor(now / 1000);
  const mac = createHmac('sha256', billingEnvironment.STRIPE_WEBHOOK_SECRET)
    .update(`${timestamp}.${raw}`)
    .digest('hex');
  return [raw, `t=${timestamp},v1=${mac}`] as const;
}

describe('hosted billing commands and verified reconciliation', () => {
  it('creates an owner-bound checkout with audited consent and reuses it on retry', async () => {
    expect(await startCheckout('essential', 'test-v1')).toContain('checkout.stripe.com');
    expect(await startCheckout('essential', 'test-v1')).toContain('checkout.stripe.com');
    expect(fake.createCustomer).toHaveBeenCalledTimes(1);
    expect(fake.checkout).toHaveBeenCalledTimes(1);
    expect(fake.checkout.mock.calls[0]![0]).toMatchObject({
      customer: 'cus_owner',
      mode: 'subscription',
      line_items: [{ price: 'price_essential', quantity: 1 }],
      allowed_payment_method_types: ['card'],
    });
    expect(fake.checkout.mock.calls[0]![0].subscription_data.metadata.person_id).toBe(
      emptyBilling.person_id,
    );
    expect(attempt).toMatchObject({
      terms: 'test-v1',
      termsText: billingEnvironment.FOUNDING_TERMS_TEXT,
      tier: 'essential',
    });
    expect(summary.billing_state).toBe('none');
  });
  it('recovers provider uncertainty with the same persisted idempotency key', async () => {
    fake.checkout.mockRejectedValueOnce(new Error('network timeout'));
    await expect(startCheckout('essential', 'test-v1')).rejects.toThrow();
    await startCheckout('essential', 'test-v1');
    expect(fake.checkout.mock.calls[0]![1]).toEqual(fake.checkout.mock.calls[1]![1]);
    expect(fake.checkout.mock.calls[0]![0]).toEqual(fake.checkout.mock.calls[1]![0]);
  });
  it('blocks duplicate subscriptions, concurrent checkout, stale terms, unsupported portal settings and anonymous purchases', async () => {
    await expect(startCheckout('essential', 'old-version')).rejects.toThrow('Paid enrollment');
    fake.identity.mockResolvedValueOnce(null);
    await expect(startCheckout('essential', 'test-v1')).rejects.toThrow('Sign in');
    const portal = testPortal();
    portal.features.subscription_cancel.mode = 'immediately';
    fake.portalConfig.mockImplementation(async (id: string) => {
      if (id === 'bpc_fixture') return portal;
      const recovery = testPortal();
      recovery.features.subscription_update.enabled = false;
      return recovery;
    });
    await expect(startCheckout('essential', 'test-v1')).rejects.toThrow('configuration');
    portal.features.subscription_cancel.mode = 'at_period_end';
    sub = testSubscription();
    await expect(startCheckout('essential', 'test-v1')).rejects.toThrow('already have');
    sub = null;
    held = true;
    await expect(startCheckout('essential', 'test-v1')).rejects.toThrow('updating');
  });
  it('rejects forged signatures and ignores unmapped customers even with member metadata', async () => {
    const [raw] = event('invoice.paid', {
      customer: 'cus_attacker',
      metadata: { person_id: emptyBilling.person_id },
    });
    await expect(handleWebhook(raw, 't=0,v1=forged')).rejects.toThrow('signature');
    await handleWebhook(
      ...event('invoice.paid', {
        customer: 'cus_attacker',
        metadata: { person_id: emptyBilling.person_id },
      }),
    );
    expect(fake.list).not.toHaveBeenCalled();
    expect(summary.subscription_id).toBeNull();
  });
  it('reconciles current provider state for reordered events and cannot reactivate on an old paid event', async () => {
    summary.customer_id = 'cus_owner';
    sub = testSubscription();
    await handleWebhook(...event('invoice.paid', { customer: 'cus_owner' }, 'evt_paid'));
    expect(summary.billing_state).toBe('active');
    sub.status = 'canceled';
    await handleWebhook(
      ...event('customer.subscription.deleted', { customer: 'cus_owner' }, 'evt_cancel'),
    );
    await handleWebhook(...event('invoice.paid', { customer: 'cus_owner' }, 'evt_old_paid'));
    await handleWebhook(...event('invoice.paid', { customer: 'cus_owner' }, 'evt_paid'));
    expect(summary.billing_state).toBe('canceled');
    expect(summary.access_until).toBeNull();
  });
  it('holds access on full refunds and disputes, preserving the hold across renewal refreshes', async () => {
    summary.customer_id = 'cus_owner';
    sub = testSubscription();
    fake.charge.mockResolvedValue({ id: 'ch_owner', customer: 'cus_owner', refunded: true });
    await handleWebhook(...event('charge.refunded', { id: 'ch_owner' }, 'evt_refund'));
    expect(summary.payment_hold).toBe(true);
    expect(summary.billing_state).toBe('unpaid');
    await refreshBilling();
    expect(summary.payment_hold).toBe(true);
    holds = {};
    fake.dispute.mockResolvedValue({
      id: 'dp_owner',
      charge: 'ch_owner',
      status: 'needs_response',
    });
    await handleWebhook(...event('charge.dispute.created', { id: 'dp_owner' }, 'evt_dispute'));
    expect(summary.billing_state).toBe('unpaid');
    fake.dispute.mockResolvedValue({ id: 'dp_owner', charge: 'ch_owner', status: 'won' });
    await handleWebhook(...event('charge.dispute.closed', { id: 'dp_owner' }, 'evt_won'));
    expect(summary.payment_hold).toBe(false);
    expect(summary.billing_state).toBe('active');
  });
  it('refreshes dispute facts under the lease rather than applying a stale pre-lock status', async () => {
    summary.customer_id = 'cus_owner';
    sub = testSubscription();
    fake.charge.mockResolvedValue({ id: 'ch_owner', customer: 'cus_owner' });
    fake.dispute
      .mockResolvedValueOnce({ id: 'dp_owner', charge: 'ch_owner', status: 'needs_response' })
      .mockResolvedValue({ id: 'dp_owner', charge: 'ch_owner', status: 'won' });
    await handleWebhook(...event('charge.dispute.created', { id: 'dp_owner' }, 'evt_late_dispute'));
    expect(summary.payment_hold).toBe(false);
    expect(summary.billing_state).toBe('active');
    expect(fake.dispute).toHaveBeenCalledTimes(2);
  });
  it('opens the mapped owner portal even with new enrollment disabled', async () => {
    summary.customer_id = 'cus_owner';
    vi.stubEnv('STRIPE_CHECKOUT_ENABLED', 'false');
    expect(await openPortal()).toContain('billing.stripe.com');
    expect(fake.portal.mock.calls[0]![0].customer).toBe('cus_owner');
    await expect(startCheckout('essential', 'test-v1')).rejects.toThrow('not open');
  });
  it('keeps cancellation available when archived prices or unsafe plan settings prevent new sales', async () => {
    summary.customer_id = 'cus_owner';
    fake.prices.mockImplementation(async () => ({ ...testPrice(), active: false }));
    expect(await openPortal()).toContain('billing.stripe.com');
    expect(fake.portal.mock.calls[0]![0].configuration).toBe('bpc_recovery');
    await expect(startCheckout('essential', 'test-v1')).rejects.toThrow('prices');
  });
  it('does not charge for another subscription while a refund hold prevents access', async () => {
    summary.customer_id = 'cus_owner';
    summary.payment_hold = true;
    await expect(startCheckout('essential', 'test-v1')).rejects.toThrow('support review');
    expect(fake.checkout).not.toHaveBeenCalled();
  });
  it('rejects cross-origin requests, client-supplied IDs and missing recurring consent', async () => {
    const request = (body: unknown, origin = 'http://127.0.0.1:3100') =>
      new NextRequest('http://127.0.0.1:3100/api/billing', {
        method: 'POST',
        headers: { origin, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    expect((await POST(request({ action: 'portal' }, 'https://attacker.example'))).status).toBe(
      403,
    );
    expect((await POST(request({ action: 'portal', customer: 'cus_attacker' }))).status).toBe(400);
    expect(
      (
        await POST(
          request({
            action: 'checkout',
            tier: 'essential',
            termsVersion: 'test-v1',
            consent: false,
          }),
        )
      ).status,
    ).toBe(400);
    expect(fake.checkout).not.toHaveBeenCalled();
  });
});
