import { currentFounderAccess } from '@/domains/access/founder';
import Link from 'next/link';
import { currentPerson } from '@/domains/person/current';
import { currentBilling } from '@/domains/billing/provider';
import { billingPaidActive } from '@/domains/billing/policy';
import { billingConfig } from '@/domains/billing/config';
import { foundingPlan, foundingPrice } from '@/domains/billing/founding-catalog';
import { MembershipControls } from '@/components/membership-controls';
import './membership.css';

export const dynamic = 'force-dynamic';
export default async function Membership({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const person = await currentPerson();
  const founder = person ? await currentFounderAccess().catch(() => false) : false;
  const params = await searchParams;
  const config = billingConfig(process.env);
  let billing: Awaited<ReturnType<typeof currentBilling>> = null;
  let unavailable = false;
  if (person) {
    try {
      billing = await currentBilling();
    } catch {
      unavailable = true;
    }
  }
  const plan = billing?.paid_tier ? foundingPlan(billing.paid_tier) : null;
  const active = billingPaidActive(billing);
  const hasSubscription =
    !!billing?.subscription_id &&
    !['none', 'canceled', 'incomplete_expired'].includes(billing.provider_status);
  return (
    <>
      <div className="page-heading compact-heading">
        <div>
          <p className="eyebrow">Aethelios / Your membership</p>
          <h1>Your founding chapter.</h1>
        </div>
      </div>
      <div className="membership-grid">
        <section className="panel">
          <p className="eyebrow">Your account</p>
          <h2>{active && plan ? `${plan.name} membership` : 'Membership access'}</h2>
          {!person ? (
            <>
              <p>Sign in to view your own plan and manage billing.</p>
              <Link className="button" href="/join">
                Sign in →
              </Link>
            </>
          ) : (
            <>
              {unavailable ? (
                <p role="alert">
                  Your billing account could not be loaded. Please try again shortly.
                </p>
              ) : (
                <>
                  {params.checkout === 'returned' && (
                    <p role="status">
                      You returned from checkout. This page does not confirm payment; verified
                      billing status below controls paid access.
                    </p>
                  )}
                  {params.checkout === 'canceled' && (
                    <p>Checkout was closed. Your existing access is unchanged.</p>
                  )}
                  <p>
                    {active
                      ? `${plan ? foundingPrice(plan) : 'Paid plan'} / month USD. Paid access confirmed.`
                      : billing?.payment_hold
                        ? 'Payment is under review. Paid access is paused. Contact membership support for a review.'
                        : hasSubscription
                          ? 'Payment confirmation is needed before paid access is available.'
                          : 'No paid subscription is confirmed. Existing invitation and founder access are managed separately.'}
                  </p>
                  {billing?.access_until && active && (
                    <p>
                      {billing.cancel_at_period_end
                        ? 'Cancellation scheduled. Paid access ends'
                        : 'Current paid access runs through'}{' '}
                      {new Intl.DateTimeFormat('en-US', {
                        dateStyle: 'long',
                        timeZone: 'UTC',
                      }).format(new Date(billing.access_until))}{' '}
                      (UTC).
                    </p>
                  )}
                  {billing?.synchronized_at && (
                    <p>
                      Last verified:{' '}
                      {new Intl.DateTimeFormat('en-US', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                        timeZone: 'UTC',
                      }).format(new Date(billing.synchronized_at))}{' '}
                      UTC. Refresh after changes in Stripe.
                    </p>
                  )}
                </>
              )}
              {!config?.enrollment && (
                <p>
                  Paid enrollment is not open yet. Launch terms and benefits will be confirmed
                  before payment is accepted.
                </p>
              )}
              {config?.supportEmail && (
                <p>
                  <a className="text-link" href={`mailto:${config.supportEmail}`}>
                    Contact membership support →
                  </a>
                </p>
              )}
              {!unavailable && (
                <MembershipControls
                  founderAudit={founder}
                  enrollment={!!config?.enrollment && !billing?.payment_hold}
                  hasCustomer={!!billing?.customer_id && !!config}
                  hasSubscription={hasSubscription}
                  termsVersion={config?.termsVersion ?? ''}
                  terms={config?.enrollment ? config.terms : ''}
                />
              )}
            </>
          )}
        </section>
        <aside className="panel perspective-panel">
          <p className="eyebrow">Clear from the beginning</p>
          <h2>A foundation that grows.</h2>
          <p>
            Essential includes personal guidance and confirmed memory. Signature and Reserve add
            Studio image creation within the current app limits.
          </p>
          <p>
            Voice, expanded allowances, Shopify member offers and curated product bundles remain
            planned. Their terms and availability will be announced separately. Membership never
            provides clinical care.
          </p>
          <Link className="text-link" href="/membership">
            Compare founding levels →
          </Link>
          <Link className="text-link" href="/launch">
            Explore the coming collection →
          </Link>
          <Link className="text-link" href="/app/you">
            Back to your account →
          </Link>
        </aside>
      </div>
    </>
  );
}
