import Link from 'next/link';
import '@/app/ecosystem.css';
export const metadata = {
  title: 'Aethelios Lifestyle — Legacy Reserve',
  description:
    'Premium grooming and personal-care products. Existing Shopify commerce remains authoritative.',
};
export default function Lifestyle() {
  return (
    <div className="ecosystem-page">
      <header className="ecosystem-heading">
        <p className="eyebrow">AETHELIOS LIFESTYLE / LEGACY RESERVE</p>
        <h1>
          Presence.
          <br />
          Considered.
        </h1>
        <p className="lead">
          Legacy Reserve is the flagship grooming and personal-care product brand within Aethelios.
          Its identity and product equity remain its own.
        </p>
        <Link className="button" href="/app/collection">
          Explore the verified collection →
        </Link>
      </header>
      <section className="health-literacy">
        <h2>A ritual with a reason.</h2>
        <article>
          <h3>Virelis & the collection</h3>
          <p>
            Discover the brand’s products through the existing collection. Product claims,
            ingredients, prices and availability should come from verified catalog information, not
            invented recommendations.
          </p>
        </article>
        <article>
          <h3>Choose with understanding.</h3>
          <p>
            Read the product label and usage instructions. Consider your preferences and
            sensitivities. General product education does not diagnose a skin condition or
            substitute for professional advice.
          </p>
        </article>
        <article>
          <h3>One commerce system.</h3>
          <p>
            Shopify owns physical-product catalog, checkout, inventory, orders and fulfillment.
            Stripe owns software subscriptions. No second inventory or order system is introduced.
          </p>
        </article>
      </section>
      <section className="ecosystem-note">
        <h2>Your membership and your products.</h2>
        <p>
          The new software memberships do not imply a physical-product bundle. Member benefits
          require approved commercial terms. Connected commerce appears only where merchant
          configuration supports it; this page does not assert stock, prices or checkout readiness.
        </p>
        <Link href="/app/collection/cabinet">Open your existing Cabinet →</Link>
      </section>
    </div>
  );
}
