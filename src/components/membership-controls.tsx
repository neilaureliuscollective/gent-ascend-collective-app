'use client';
import { useState } from 'react';
import type { BillingReadiness } from '@/domains/billing/readiness-contract';
import { useRouter } from 'next/navigation';
import { foundingPlans, foundingPrice } from '@/domains/billing/founding-catalog';

export function MembershipControls({
  enrollment,
  hasCustomer,
  hasSubscription,
  termsVersion,
  terms,
  founderAudit = false,
}: {
  enrollment: boolean;
  hasCustomer: boolean;
  hasSubscription: boolean;
  termsVersion: string;
  terms: string;
  founderAudit?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<BillingReadiness | null>(null);
  const [message, setMessage] = useState('');
  const router = useRouter();
  async function submit(payload: unknown) {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Billing is temporarily unavailable.');
      if (result.url) {
        const url = new URL(result.url);
        if (
          url.protocol !== 'https:' ||
          !['checkout.stripe.com', 'billing.stripe.com'].includes(url.hostname)
        )
          throw new Error('The payment destination could not be verified.');
        window.location.assign(url.href);
      } else {
        setMessage('Your billing status has been refreshed.');
        router.refresh();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Billing could not be reached.');
    } finally {
      setBusy(false);
    }
  }
  async function inspect() {
    if (busy) return;
    setBusy(true);
    setReport(null);
    setMessage('');
    try {
      const response = await fetch('/api/billing/readiness', { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Readiness could not be checked.');
      setReport(result);
      setMessage('Billing configuration checked. Live acceptance remains separate.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Readiness could not be reached.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      {founderAudit && (
        <details>
          <summary>Founder / Revenue readiness</summary>
          <p>
            Inspect current billing configuration. This check creates no charges and does not open
            enrollment.
          </p>
          <button className="secondary-button" disabled={busy} onClick={inspect}>
            Check billing readiness
          </button>
          {report && (
            <div>
              <p>Checked: {report.checkedAt}</p>
              <ul>
                {report.checks.map((check) => (
                  <li key={check.name}>
                    <strong>
                      {check.name} — {check.status}
                    </strong>
                    <p>{check.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </details>
      )}
      {hasCustomer && (
        <div className="membership-actions">
          <button className="button" disabled={busy} onClick={() => submit({ action: 'portal' })}>
            Manage billing securely ↗
          </button>
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => submit({ action: 'refresh' })}
          >
            Refresh payment status
          </button>
          <p>
            Stripe shows the charge before you confirm a plan change. Downgrades and cancellations
            take effect at renewal. Payment must be confirmed before additional access unlocks.
          </p>
        </div>
      )}
      {enrollment && !hasSubscription && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            submit({
              action: 'checkout',
              tier: data.get('tier'),
              consent: data.get('consent') === 'on',
              termsVersion,
            });
          }}
        >
          <p>Monthly recurring prices in USD. Review taxes at checkout.</p>
          <label htmlFor="founding-tier">Your founding level</label>
          <select id="founding-tier" name="tier" disabled={busy} required defaultValue="essential">
            {foundingPlans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} — {foundingPrice(plan)}/mo
              </option>
            ))}
          </select>
          <div className="membership-terms">
            <h3>Founding launch terms</h3>
            <p>{terms}</p>
            <p>Terms version: {termsVersion}</p>
          </div>
          <label className="membership-consent">
            <input type="checkbox" name="consent" disabled={busy} required /> I agree to these
            launch terms and monthly recurring billing. Taxes, if applicable, are shown at checkout.
          </label>
          <button className="button" disabled={busy}>
            Continue to secure checkout ↗
          </button>
        </form>
      )}
      <p role="status" aria-live="polite">
        {busy ? 'Contacting billing…' : message}
      </p>
    </div>
  );
}
