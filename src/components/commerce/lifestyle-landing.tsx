import Link from 'next/link';
import Image from 'next/image';
import type { CollectionEntry } from '@/domains/commerce/collection';
import { CollectionCard } from './collection-card';

export function LifestyleLanding({
  entries,
  status,
  basePath = '/app/collection',
  lifestylePath = '/app/lifestyle',
}: {
  basePath?: string;
  lifestylePath?: string;
  entries: CollectionEntry[];
  status: 'ready' | 'empty' | 'unconfigured' | 'error';
}) {
  const featured = status === 'ready' ? entries.find((entry) => entry.image) : undefined;
  return (
    <div className="reserve-commerce lifestyle-world">
      <header className="lifestyle-hero">
        <div className="lifestyle-hero-copy">
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
            Aethelios Lifestyle. Aethelios Human Ascendance products.
            <br />A higher standard for the everyday.
          </p>
          <div className="collection-entry-actions">
            <Link className="world-button" href={basePath}>
              Explore the collection
            </Link>
            <Link className="world-text-link" href={`${basePath}/cart`}>
              Your cart
            </Link>
          </div>
          <span className="lifestyle-hero-foot">CARE · CHARACTER · DAILY RITUAL</span>
        </div>
        {featured?.image && (
          <Link className="lifestyle-hero-product" href={`${basePath}/${featured.handle}`}>
            <Image
              src={featured.image.url}
              alt={featured.image.altText ?? featured.title}
              width={featured.image.width ?? 800}
              height={featured.image.height ?? 1000}
              sizes="(max-width: 700px) 86vw, 40vw"
              preload
            />
            <span>
              {featured.title} <small>{featured.price}</small>
            </span>
          </Link>
        )}
      </header>
      <section className="collection-browse" aria-labelledby="lifestyle-products">
        <div className="collection-browse-heading">
          <div>
            <span className="world-kicker">The collection</span>
            <h2 id="lifestyle-products">
              Discover your <em>daily essentials.</em>
            </h2>
          </div>
          <Link className="world-text-link" href={basePath}>
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
              <Link className="world-button" href={lifestylePath}>
                Try again
              </Link>
            )}
          </div>
        ) : (
          <div className="reserve-collection-grid">
            {entries.slice(0, 3).map((entry, index) => (
              <CollectionCard key={entry.handle} entry={entry} index={index} basePath={basePath} />
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
        <Link className="world-text-link" href={`${basePath}/cart`}>
          Your cart →
        </Link>
      </footer>
    </div>
  );
}
