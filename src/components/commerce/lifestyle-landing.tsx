import Link from 'next/link';
import type { CollectionEntry } from '@/domains/commerce/collection';
import { CollectionCard } from './collection-card';
import { lifestyleBrands } from '@/domains/commerce/lifestyle';

export function LifestyleLanding({
  entries,
  status,
}: {
  entries: CollectionEntry[];
  status: 'ready' | 'empty' | 'unconfigured' | 'error';
}) {
  return (
    <div className="reserve-commerce lifestyle-world">
      <header className="lifestyle-hero">
        <div className="lifestyle-coordinate" aria-hidden="true">
          A / L — 01
        </div>
        <span className="world-kicker">AETHELIOS / THE HUMAN ASCENDANCE</span>
        <h1>
          The art of
          <br />
          <em>living well.</em>
        </h1>
        <p className="lifestyle-lead">Aethelios Lifestyle</p>
        <p>
          Considered products. Distinctive brands.
          <br />A higher standard for the everyday.
        </p>
        <div className="collection-entry-actions">
          <Link className="world-button" href="/app/lifestyle/legacy-reserve">
            Discover Legacy Reserve →
          </Link>
          <Link className="world-text-link" href="/app/collection">
            Explore the collection
          </Link>
        </div>
        <span className="lifestyle-hero-foot">CARE · CHARACTER · DAILY RITUAL</span>
      </header>
      <section className="lifestyle-brands" aria-labelledby="lifestyle-brands">
        <div className="lifestyle-section-heading">
          <span className="world-kicker">01 / Our brands</span>
          <h2 id="lifestyle-brands">
            Individual character.
            <br />
            <em>One shared ambition.</em>
          </h2>
        </div>
        {lifestyleBrands.map((brand) => (
          <article className="lifestyle-brand" key={brand.slug}>
            <span className="world-kicker">THE FLAGSHIP / GROOMING & PERSONAL CARE</span>
            <h3>{brand.name}</h3>
            <p>{brand.description}</p>
            <Link className="world-text-link" href={`/app/lifestyle/${brand.slug}`}>
              Enter the brand →
            </Link>
          </article>
        ))}
      </section>
      <section className="collection-browse" aria-labelledby="lifestyle-products">
        <div className="collection-browse-heading">
          <div>
            <span className="world-kicker">02 / The collection</span>
            <h2 id="lifestyle-products">
              Discover your <em>daily essentials.</em>
            </h2>
          </div>
          <Link className="world-text-link" href="/app/collection">
            View the collection →
          </Link>
        </div>
        {status !== 'ready' ? (
          <div className="collection-empty" role="status">
            <h3>
              {status === 'error'
                ? 'The collection could not refresh.'
                : 'The collection is being prepared.'}
            </h3>
            <p>
              {status === 'error'
                ? 'Please try again. Current prices and availability could not be verified.'
                : status === 'unconfigured'
                  ? 'Live product availability is not connected yet. Products are not available to order here.'
                  : 'No published products are available in this collection yet.'}
            </p>
            {status === 'error' && (
              <Link className="world-button" href="/app/lifestyle">
                Try again
              </Link>
            )}
          </div>
        ) : (
          <div className="reserve-collection-grid">
            {entries.slice(0, 3).map((entry, index) => (
              <CollectionCard
                key={entry.handle}
                entry={entry}
                index={index}
                basePath="/app/collection"
              />
            ))}
          </div>
        )}
      </section>
      <footer className="collection-world-footer">
        <span className="world-kicker">AETHELIOS LIFESTYLE</span>
        <h2>
          A daily standard.
          <br />
          <em>Entirely your own.</em>
        </h2>
        <p>
          Explore each product&apos;s details, options and current availability. Product purchases
          do not require a paid membership. Shipping, taxes and final totals are confirmed by
          Shopify at checkout.
        </p>
        <Link className="world-text-link" href="/app/collection/cart">
          Your cart →
        </Link>
      </footer>
    </div>
  );
}
