import 'server-only';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { currentIdentity } from '@/domains/identity/current';
import { currentPerson } from '@/domains/person/current';
import { supabaseConnection } from '@/platform/supabase/connection';
import type { Database } from '@/platform/supabase/database';
import { billingConfig, type BillingConfig } from './config';
import { portalSafe, priceTier, subscriptionSnapshot, type BillingSummary } from './policy';
import type { FoundingTier } from './founding-catalog';

export class BillingError extends Error {
  constructor(
    message: string,
    public status = 503,
  ) {
    super(message);
  }
}
type Attempt = {
  id: string;
  tier: FoundingTier;
  terms: string;
  termsText: string;
  price: string;
  origin: string;
  created: number;
  expires: number;
  session?: string;
};
type Lease = { profile: BillingSummary; attempt: Attempt | null; holds: Record<string, boolean> };

function configured() {
  const config = billingConfig(process.env);
  if (!config) throw new BillingError('Membership billing is not available yet.');
  return config;
}
function provider(config: BillingConfig) {
  return new Stripe(config.secret, {
    apiVersion: '2026-09-30.endive',
    maxNetworkRetries: 2,
    timeout: 15000,
  });
}
/** Service credentials are restricted to provider control RPCs; normal reads use the session. */
async function control<T>(
  command: string,
  person: string | null,
  token: string | null,
  payload: unknown = {},
): Promise<T> {
  const connection = supabaseConnection(process.env);
  if (!connection || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new BillingError('Billing connection is unavailable.');
  const client = createClient<Database>(connection.url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const result = await client.rpc('billing_control', {
    p_command: command,
    p_person: person,
    p_token: token,
    p_payload: payload,
  });
  if (result.error)
    throw new BillingError(
      result.error.code === '55P03'
        ? 'Your billing account is updating. Please retry shortly.'
        : 'Billing account could not be updated.',
      result.error.code === '55P03' ? 409 : 503,
    );
  return result.data as T;
}
async function owner() {
  const identity = await currentIdentity();
  if (!identity) throw new BillingError('Sign in to manage your membership.', 401);
  const verified = await identity.client.auth.getUser();
  if (
    verified.error ||
    !verified.data.user?.email_confirmed_at ||
    verified.data.user.id !== identity.authUserId ||
    verified.data.user.is_anonymous
  )
    throw new BillingError('Confirm your email and sign in before managing billing.', 401);
  const person = await currentPerson();
  if (!person) throw new BillingError('Your account is unavailable.', 401);
  return person;
}
export async function currentBilling() {
  const identity = await currentIdentity();
  const person = await currentPerson();
  if (!identity || !person) return null;
  const result = await identity.client
    .from('billing_profiles')
    .select('*')
    .eq('person_id', person.id)
    .maybeSingle();
  // A missing migration is not an absent subscription. Do not present a new paid enrollment.
  if (result.error) throw new BillingError('Your billing account is temporarily unavailable.');
  return result.data;
}
async function withLease<T>(person: string, work: (lease: Lease, token: string) => Promise<T>) {
  const token = randomUUID();
  const lease = await control<Lease>('acquire', person, token);
  try {
    return await work(lease, token);
  } finally {
    await control('release', person, token).catch(() => undefined);
  }
}
async function subscriptions(stripe: Stripe, customer: string) {
  const result = await stripe.subscriptions.list({
    customer,
    status: 'all',
    limit: 100,
    expand: ['data.latest_invoice'],
  });
  if (result.has_more) throw new BillingError('Your subscriptions require a billing review.');
  const managed = result.data.filter((sub) => sub.metadata.gent_ascend === 'founding-v1');
  const nonterminal = managed.filter(
    (sub) => !['canceled', 'incomplete_expired'].includes(sub.status),
  );
  if (nonterminal.length > 1)
    throw new BillingError('Your subscriptions require a billing review.', 409);
  return {
    current: nonterminal[0] ?? managed.sort((a, b) => b.created - a.created)[0] ?? null,
    hasSubscription: nonterminal.length > 0,
  };
}
async function validatePrices(stripe: Stripe, config: BillingConfig) {
  const prices = await Promise.all(
    Object.values(config.prices).map((id) => stripe.prices.retrieve(id)),
  );
  if (
    new Set(
      prices.map((price) => (typeof price.product === 'string' ? price.product : price.product.id)),
    ).size !== 1 ||
    prices.some((price) => !price.active || !priceTier(price, config))
  )
    throw new BillingError('Membership prices are awaiting verification.');
}
async function recoveryPortal(stripe: Stripe, config: BillingConfig) {
  const portal = await stripe.billingPortal.configurations.retrieve(config.recoveryPortal);
  if (
    !portal.active ||
    portal.livemode !== config.live ||
    !portal.features.payment_method_update.enabled ||
    !portal.features.invoice_history.enabled ||
    !portal.features.subscription_cancel.enabled ||
    portal.features.subscription_cancel.mode !== 'at_period_end' ||
    portal.features.subscription_cancel.proration_behavior !== 'none' ||
    portal.features.subscription_update.enabled
  )
    throw new BillingError('Membership cancellation is awaiting configuration.');
  return config.recoveryPortal;
}
async function safePortal(stripe: Stripe, config: BillingConfig) {
  await validatePrices(stripe, config);
  await recoveryPortal(stripe, config);
  if (!portalSafe(await stripe.billingPortal.configurations.retrieve(config.portal), config))
    throw new BillingError('Membership management is awaiting configuration.');
}

export async function startCheckout(tier: FoundingTier, acceptedTerms: string) {
  const config = configured();
  if (!config.enrollment || acceptedTerms !== config.termsVersion)
    throw new BillingError('Paid enrollment is not open. Review the current launch terms.', 409);
  const person = await owner();
  const stripe = provider(config);
  await safePortal(stripe, config); // Never sell a plan without a working cancellation path.
  return withLease(person.id, async (lease, token) => {
    if (lease.profile.payment_hold || Object.values(lease.holds).some(Boolean))
      throw new BillingError(
        'Your payment account needs a support review before another subscription can be started.',
        409,
      );
    let customer = lease.profile.customer_id;
    if (!customer) {
      customer = (
        await stripe.customers.create(
          { metadata: { gent_ascend: 'founding-v1', person_id: person.id } },
          { idempotencyKey: `gent:customer:${person.id}` },
        )
      ).id;
      await control('bind', person.id, token, { customer });
    }
    if ((await subscriptions(stripe, customer)).hasSubscription)
      throw new BillingError(
        'You already have a subscription. Manage it from your membership account.',
        409,
      );
    const now = Math.floor(Date.now() / 1000);
    let attempt = lease.attempt;
    if (attempt && attempt.expires > now) {
      if (
        attempt.tier !== tier ||
        attempt.terms !== acceptedTerms ||
        attempt.price !== config.prices[tier] ||
        attempt.origin !== config.origin ||
        attempt.termsText !== config.terms
      )
        throw new BillingError(
          'A checkout is already in progress. Complete it or let it expire before choosing another offer.',
          409,
        );
      if (attempt.session) {
        const existing = await stripe.checkout.sessions.retrieve(attempt.session);
        if (existing.status === 'open' && existing.url) return existing.url;
        if (existing.status === 'complete')
          throw new BillingError(
            'Your payment is being confirmed. Refresh your membership account.',
            409,
          );
        attempt = null;
      }
    } else attempt = null;
    if (!attempt) {
      attempt = {
        id: randomUUID(),
        tier,
        terms: acceptedTerms,
        termsText: config.terms,
        price: config.prices[tier],
        origin: config.origin,
        created: now,
        expires: now + 3600,
      };
      await control('reserve', person.id, token, attempt);
    }
    if (!attempt.session && attempt.expires < now + 1800)
      throw new BillingError(
        'The checkout recovery window is closing. Please retry after this checkout expires.',
        409,
      );
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        automatic_tax: { enabled: config.taxMode === 'automatic' },
        billing_address_collection: 'required',
        customer_update: { address: 'auto' },
        customer,
        client_reference_id: person.id,
        line_items: [{ price: config.prices[tier], quantity: 1 }],
        allowed_payment_method_types: ['card'],
        expires_at: attempt.expires,
        success_url: `${config.origin}/app/membership?checkout=returned`,
        cancel_url: `${config.origin}/app/membership?checkout=canceled`,
        subscription_data: {
          metadata: {
            gent_ascend: 'founding-v1',
            person_id: person.id,
            terms_version: attempt.terms,
            enrollment_attempt: attempt.id,
          },
        },
        metadata: { gent_ascend: 'founding-v1', enrollment_attempt: attempt.id },
      },
      { idempotencyKey: `gent:checkout:${attempt.id}` },
    );
    await control('reserve', person.id, token, { ...attempt, session: session.id });
    if (!session.url) throw new BillingError('Checkout could not be opened.');
    return session.url;
  });
}

export async function openPortal() {
  const config = configured();
  await owner();
  const stripe = provider(config);
  let configuration = config.portal;
  try {
    await safePortal(stripe, config);
  } catch {
    configuration = await recoveryPortal(stripe, config);
  }
  // Mapping is read with the signed-in session, never supplied by the browser.
  const billing = await currentBilling();
  if (!billing?.customer_id)
    throw new BillingError('There is no billing account to manage yet.', 409);
  return (
    await stripe.billingPortal.sessions.create({
      customer: billing.customer_id,
      configuration,
      return_url: `${config.origin}/app/membership`,
    })
  ).url;
}

async function syncCustomer(
  stripe: Stripe,
  config: BillingConfig,
  person: string,
  event?: string,
  readHold?: () => Promise<{ key: string; value: boolean }>,
) {
  return withLease(person, async (lease, token) => {
    if (!lease.profile.customer_id) throw new BillingError('Billing account is not bound.');
    const hold = await readHold?.(); // Financial facts are also refreshed inside the serialization boundary.
    const { current } = await subscriptions(stripe, lease.profile.customer_id);
    const holds = { ...lease.holds, ...(hold ? { [hold.key]: hold.value } : {}) };
    const snapshot = subscriptionSnapshot(
      current,
      lease.profile,
      config,
      Object.values(holds).some(Boolean),
    );
    await control('sync', person, token, {
      ...snapshot,
      event: event ?? null,
      holdKey: hold?.key ?? null,
      holdValue: hold?.value ?? null,
    });
    return snapshot;
  });
}
export async function refreshBilling() {
  const config = configured();
  const person = await owner();
  const billing = await currentBilling();
  if (!billing?.customer_id) throw new BillingError('No paid subscription has been started.', 409);
  return syncCustomer(provider(config), config, person.id);
}

const eventTypes = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'checkout.session.expired',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.payment_action_required',
  'invoice.voided',
  'invoice.marked_uncollectible',
  'charge.refunded',
  'charge.dispute.created',
  'charge.dispute.updated',
  'charge.dispute.closed',
]);
export async function handleWebhook(raw: string, signature: string) {
  const config = configured();
  const stripe = provider(config);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, config.webhookSecret);
  } catch {
    throw new BillingError('Invalid webhook signature.', 400);
  }
  if (event.livemode !== config.live) throw new BillingError('Webhook mode does not match.', 400);
  if (!eventTypes.has(event.type)) return;
  const object = event.data.object as unknown as {
    customer?: string | { id: string } | null;
    id: string;
  };
  let customer = typeof object.customer === 'string' ? object.customer : object.customer?.id;
  let readHold: (() => Promise<{ key: string; value: boolean }>) | undefined;
  if (event.type === 'charge.refunded') {
    const charge = await stripe.charges.retrieve(object.id);
    customer = typeof charge.customer === 'string' ? charge.customer : charge.customer?.id;
    readHold = async () => {
      const current = await stripe.charges.retrieve(charge.id);
      return { key: `refund:${current.id}`, value: current.refunded };
    };
  } else if (event.type.startsWith('charge.dispute.')) {
    const dispute = await stripe.disputes.retrieve(object.id);
    const charge =
      typeof dispute.charge === 'string'
        ? await stripe.charges.retrieve(dispute.charge)
        : dispute.charge;
    customer = typeof charge.customer === 'string' ? charge.customer : charge.customer?.id;
    readHold = async () => {
      const current = await stripe.disputes.retrieve(dispute.id);
      return {
        key: `dispute:${current.id}`,
        value: !['won', 'warning_closed'].includes(current.status),
      };
    };
  }
  if (!customer) return;
  const mapping = await control<{ person: string } | null>('lookup', null, null, { customer });
  if (!mapping) return; // Other Stripe customers never become Gent Ascend members from metadata.
  await syncCustomer(stripe, config, mapping.person, event.id, readHold);
}
