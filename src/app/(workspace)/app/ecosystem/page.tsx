import { AmbientHorizon } from '@/components/visual/ambient-horizon';
import Image from 'next/image';
import Link from 'next/link';
import { brand } from '@/platform/brand';
import { legacyReserveDestination } from '@/platform/ecosystem';
import './ecosystem.css';

export const metadata = { title: 'Aethelios Ecosystem' };
const launchPlans = [
  { name: 'Access', price: 'Free', detail: 'Begin your relationship with Aethelios.' },
  { name: 'Essential', price: '$19.99', detail: 'A foundation for your personal intelligence.' },
  { name: 'Signature', price: '$49.99', detail: 'A deeper environment for life and work.' },
  { name: 'Architect', price: '$129', detail: 'The planned tier for ambitious builders.' },
];
export default function EcosystemPage() {
  const reserve = legacyReserveDestination(process.env.LEGACY_RESERVE_PUBLIC_URL);
  return (
    <section className="io-ecosystem" aria-labelledby="ecosystem-title">
      <header className="io-ecosystem-hero io-hero">
        <AmbientHorizon />
        <Image
          className="io-ecosystem-lockup"
          src={brand.lockup}
          alt={brand.lockupAlt}
          width={1254}
          height={1254}
          sizes="180px"
        />
        <p className="eyebrow">AETHELIOS / THE HUMAN ASCENDANCE</p>
        <h1 id="ecosystem-title">
          One world.
          <br />
          <em>A greater possibility.</em>
        </h1>
        <p>
          Intelligence, biological understanding and considered living. Connected by a shared
          ambition: to expand human potential.
        </p>
        <a className="secondary-button" href="#ecosystem-membership">
          Explore membership ↓
        </a>
      </header>
      <div className="io-division-grid">
        <article className="io-division io-division-intelligence">
          <span className="io-division-number" aria-hidden="true">
            01 / INTELLIGENCE
          </span>
          <h2>Aethelios Intelligence</h2>
          <p className="io-division-promise">Think clearly. Build deliberately.</p>
          <p>
            Your personal and professional intelligence environment. Continue conversations, develop
            company work and shape creative projects with the tools available today.
          </p>
          <nav className="io-division-links" aria-label="Intelligence environments">
            <Link href="/app/aethelios">Talk ↗</Link>
            <Link href="/app/work">Work ↗</Link>
            <Link href="/app/studio">Studio ↗</Link>
          </nav>
        </article>
        <article className="io-division">
          <span className="io-division-number" aria-hidden="true">
            02 / HEALTH
          </span>
          <h2>Aethelios Health</h2>
          <p className="io-division-promise">Know More. Live Better.</p>
          <p>
            Your private Health Command brings source-led wellness, records and reviewed labs into
            context. Sensitive ingestion and personalized AI require privacy release acceptance.
          </p>
          <p className="io-division-boundary">
            Educational and personal planning experiences. No prescribing or clinical care is
            offered here.
          </p>
          <nav className="io-division-links" aria-label="Available health and performance tools">
            <Link href="/app/health" prefetch={false}>
              Health Command ↗
            </Link>
            <Link href="/app/daily">Personal check-ins ↗</Link>
            <Link href="/app/performance">Performance ↗</Link>
          </nav>
        </article>
        <article className="io-division">
          <span className="io-division-number" aria-hidden="true">
            03 / LIFESTYLE
          </span>
          <h2>Aethelios Lifestyle</h2>
          <p className="io-division-promise">The personal standard.</p>
          <p>
            Aethelios Lifestyle and Aethelios Human Ascendance products. Cabinet and Grooming stay
            with the collection; purchases use the same catalog.
          </p>
          <p className="io-division-boundary">
            Physical commerce is planned through Shopify. Product availability is confirmed only in
            the official store.
          </p>
          <nav className="io-division-links" aria-label="Lifestyle destinations">
            <Link href="/app/lifestyle">Lifestyle ↗</Link>
            <Link href="/app/grooming">Grooming workspace ↗</Link>
            {reserve ? (
              <a href={reserve} target="_blank" rel="noopener noreferrer">
                Current collection store
              </a>
            ) : null}
          </nav>
        </article>
      </div>
      <section
        className="io-membership"
        id="ecosystem-membership"
        aria-labelledby="membership-title"
      >
        <div className="io-membership-heading">
          <div>
            <p className="eyebrow">AETHELIOS MEMBERSHIP</p>
            <h2 id="membership-title">Choose your next chapter.</h2>
          </div>
          <Link className="secondary-button" href="/app/membership">
            Your membership ↗
          </Link>
        </div>
        <p>
          Approved initial launch lineup. These are planned offers; your current subscription and
          available access are shown in Your membership.
        </p>
        <div className="io-plan-grid">
          {launchPlans.map((plan) => (
            <article className="io-plan" key={plan.name}>
              <h3>{plan.name}</h3>
              <p className="io-plan-price">
                {plan.price}
                {plan.name !== 'Access' && <span> / month</span>}
              </p>
              <p>{plan.detail}</p>
              <span className="io-preview-label">Launch lineup</span>
            </article>
          ))}
        </div>
        <p className="io-division-boundary">
          USD monthly pricing. Ascendance and Enterprise are future offerings. Architect coding
          workflows are not presented as production-ready.
        </p>
      </section>
    </section>
  );
}
