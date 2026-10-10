import Link from 'next/link';
import type { Metadata } from 'next';
import { launchPlans, launchPrice } from '@/domains/billing/launch-catalog';
import '../founding-launch.css';
export const metadata: Metadata = {
  title: 'Aethelios memberships',
  description:
    'Access, Essential, Signature and Architect — the approved Aethelios membership direction.',
};
export default function Membership() {
  return (
    <main id="world-main" className="founding-world">
      <header className="world-page-intro founding-intro">
        <span className="world-kicker">AETHELIOS / THE HUMAN ASCENDANCE</span>
        <h1>
          Intelligence.
          <br />
          <em>At your level.</em>
        </h1>
        <p>
          Four memberships for everyday intelligence, creative work and the future of software
          creation.
        </p>
        <p className="founding-disclosure">
          Approved commercial direction. New launch enrollment is subject to verified billing,
          feature acceptance and launch approval. Existing members retain their current
          subscriptions and account access.
        </p>
      </header>
      <section id="founding-levels" className="world-section">
        <div className="founding-levels">
          {launchPlans.map((plan) => (
            <article key={plan.id} className="founding-level">
              <span className="world-kicker">Aethelios {plan.name}</span>
              <h2>{plan.name}</h2>
              <p className="founding-price">
                {launchPrice(plan.monthlyCents)}
                {plan.monthlyCents > 0 && <span> / month</span>}
              </p>
              <p className="founding-promise">{plan.focus}</p>
              <details open>
                <summary>Existing foundation</summary>
                <p>{plan.available}</p>
              </details>
              <details>
                <summary>Under development</summary>
                <p>{plan.planned}</p>
              </details>
              <p>
                USD. Usage limits and final terms must be confirmed before new enrollment. No
                unlimited agent or image-generation promise.
              </p>
              {plan.id === 'architect' && (
                <Link href="/app/architect" className="world-text-link">
                  Try the free static workshop →
                </Link>
              )}
            </article>
          ))}
        </div>
      </section>
      <section className="world-section founding-close">
        <h2>One account. Clear boundaries.</h2>
        <p>
          Stripe handles software subscriptions. Shopify handles physical products. Products are not
          bundled into the new software memberships. Historical Reserve subscriptions remain
          supported separately; they are not automatically converted to Architect.
        </p>
        <p>
          Ascendance and Enterprise are future releases. Single sign-on, clinical services and
          native app publishing are not available.
        </p>
        <Link href="/app/membership" className="world-button">
          Manage your existing membership →
        </Link>
      </section>
    </main>
  );
}
