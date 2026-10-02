import Link from 'next/link';
import type { Metadata } from 'next';
import { Chapter } from '@/components/public/editorial';
import { foundingPlans, foundingPrice } from '@/domains/billing/founding-catalog';
import '../founding-launch.css';
import { billingConfig } from '@/domains/billing/config';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Founding membership',
  description: 'Explore the three founding levels of Gent Ascend Collective.',
};
export default function Membership() {
  const enrollment = billingConfig(process.env)?.enrollment ?? false;
  return (
    <main id="world-main" className="founding-world">
      <header className="world-page-intro founding-intro">
        <span className="world-kicker">Gent Ascend Collective / Founding membership</span>
        <h1>
          Your standard.
          <br />
          <em>Your next chapter.</em>
        </h1>
        <p>
          Enter at the beginning. Choose the depth of guidance, personal attention and daily
          practice that fits the man you are becoming.
        </p>
        <div className="world-actions">
          <a href="#founding-levels" className="world-button">
            Explore the three levels ↓
          </a>
          <Link href="/launch" className="world-text-link">
            See the coming collection ↗
          </Link>
        </div>
        <p className="founding-disclosure">
          {enrollment
            ? 'Founding enrollment is open. Review the current launch terms in your membership account before subscribing.'
            : 'Founding offer preview. Paid enrollment is not open. Existing invited members can continue using their accounts.'}
        </p>
      </header>
      <section id="founding-levels" className="world-section">
        <Chapter number="01" label="Three levels. One world." />
        <div className="founding-levels">
          {foundingPlans.map((plan, index) => (
            <article key={plan.id} className={`founding-level founding-level--${plan.id}`}>
              <span className="world-kicker">0{index + 1} / Founding level</span>
              <h2>{plan.name}</h2>
              <p className="founding-promise">{plan.promise}</p>
              <p className="founding-price">
                {foundingPrice(plan)}
                <span> / month</span>
              </p>
              <p className="founding-price-note">Planned founding rate · USD · taxes may apply</p>
              <details open={index === 0}>
                <summary>Current app foundation</summary>
                <p className="founding-detail-note">
                  Personal guidance and confirmed memory are available through invitation access or
                  confirmed paid enrollment. Signature and Reserve also include Studio creation
                  within the current app limits.
                </p>
                <ul>
                  {plan.foundation.map((benefit) => (
                    <li key={benefit}>{benefit}</li>
                  ))}
                </ul>
              </details>
              <details>
                <summary>Growing into this level</summary>
                <ul>
                  {plan.planned.map((benefit) => (
                    <li key={benefit}>{benefit}</li>
                  ))}
                </ul>
                <p className="founding-detail-note">
                  Planned additions. Each benefit will be labeled when available.
                </p>
              </details>
              <details>
                <summary>Your founding product ritual</summary>
                <p>{plan.bundle}</p>
                <p className="founding-detail-note">
                  One-time bundle planned. Contents, qualification and shipment are governed by the
                  approved launch terms. These products are not currently shipping.
                </p>
              </details>
              <p className="founding-enrollment">
                {enrollment ? (
                  <Link href="/app/membership">Review terms and choose your level →</Link>
                ) : (
                  'Enrollment opening after launch terms are finalized.'
                )}
              </p>
            </article>
          ))}
        </div>
      </section>
      <section className="world-section founding-close">
        <Chapter number="02" label="A considered beginning" />
        <h2>
          Useful today.
          <br />
          <em>Built to develop.</em>
        </h2>
        <p>
          Your tier will develop as Gent Ascend grows. Founding-rate duration, current usage limits
          and product benefits are governed by the launch terms shown before you subscribe. Future
          standard prices are not yet announced. Physical products ordered separately remain
          separate from your planned founding bundle.
        </p>
        <div className="world-actions">
          <Link href="/join" className="world-button">
            Create or access your account →
          </Link>
          <Link href="/app/welcome" className="world-text-link">
            I have an invitation ↗
          </Link>
          <Link href="/launch" className="world-text-link">
            Explore the launch collection ↗
          </Link>
        </div>
      </section>
    </main>
  );
}
