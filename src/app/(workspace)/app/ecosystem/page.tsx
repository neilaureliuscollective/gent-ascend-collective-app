import Link from 'next/link';
import type { Metadata } from 'next';
import { ecosystem } from '@/domains/ecosystem/catalog';
import { ecosystemOrigin } from '@/platform/ecosystem-links';
import '@/app/ecosystem.css';
export const metadata: Metadata = {
  title: 'The Aethelios ecosystem',
  description:
    'Your existing intelligence, personal life, creative work and connected experiences.',
};
export default function Ecosystem() {
  const corporate = ecosystemOrigin(process.env.AETHELIOS_CORPORATE_ORIGIN);
  return (
    <div className="ecosystem-page">
      <header className="ecosystem-heading">
        <p className="eyebrow">AETHELIOS / THE HUMAN ASCENDANCE</p>
        <h1>
          One intelligence.
          <br />A wider horizon.
        </h1>
        <p className="lead">
          Your work, your life and the experiences around you. Continue through the environments
          already built for you.
        </p>
        <Link className="button" href="/app/aethelios">
          Continue in Talk →
        </Link>
      </header>
      <nav aria-label="Aethelios ecosystem" className="ecosystem-directory">
        {ecosystem.map((item) => (
          <article key={item.id}>
            <div>
              <p className="eyebrow">{item.status}</p>
              <h2>
                <Link href={item.href}>{item.name}</Link>
              </h2>
              <p>{item.description}</p>
            </div>
            <nav aria-label={`${item.name} destinations`}>
              {item.links.map(([label, href]) => (
                <Link href={href} key={href}>
                  {label} <span aria-hidden="true">→</span>
                </Link>
              ))}
            </nav>
          </article>
        ))}
      </nav>
      <section className="ecosystem-note">
        <h2>Your account stays yours.</h2>
        <p>
          Existing accounts, memberships, saved work and permissions continue to apply. Discovery
          does not unlock paid features or clinical services. Nothing here transfers your context to
          another business.
        </p>
        {corporate && (
          <a href={corporate} rel="noreferrer">
            Aethelios company & philosophy ↗
          </a>
        )}
      </section>
    </div>
  );
}
