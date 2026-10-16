import Link from 'next/link';
import Image from 'next/image';
import type { CollectionEntry } from '@/domains/commerce/collection';
import {
  lifestyleBrowseEntries,
  resolveLifestyleScene,
  type CatalogStatus,
} from '@/domains/commerce/lifestyle-merchandising';
import { brand } from '@/platform/brand';
import { CollectionCard } from './collection-card';
import { LifestyleProductStage } from './lifestyle-product-stage';

export function LifestyleLanding({
  entries,
  status,
  basePath = '/app/collection',
  lifestylePath = '/app/lifestyle',
}: {
  basePath?: string;
  lifestylePath?: string;
  entries: CollectionEntry[];
  status: CatalogStatus;
}) {
  const scene = resolveLifestyleScene(entries, { basePath, status });
  const browse = lifestyleBrowseEntries(entries, scene);
  return (
    <div className="reserve-commerce lifestyle-world">
      <header className="lifestyle-masthead lifestyle-hero">
        <div className="lifestyle-masthead-brand">
          <Image
            className="lifestyle-lockup"
            src={brand.crest}
            alt={brand.crestAlt}
            width={56}
            height={56}
            sizes="56px"
          />
          <div>
            <span className="world-kicker">AETHELIOS / THE HUMAN ASCENDANCE</span>
            <p className="lifestyle-masthead-name">Aethelios Lifestyle</p>
          </div>
        </div>
        <nav className="lifestyle-masthead-actions" aria-label="Lifestyle shopping">
          <Link className="world-button" href={basePath}>
            Explore the collection
          </Link>
          <Link className="world-text-link" href={`${basePath}/cart`}>
            Bag
          </Link>
        </nav>
      </header>
      <div className="lifestyle-opening">
        <div className="lifestyle-opening-copy">
          <h1>
            The art of
            <br />
            <em>living well.</em>
          </h1>
          <p className="lifestyle-lead">Aethelios Lifestyle</p>
          <p>
            Grooming, personal care and daily ritual. Browse published products, current prices and
            availability without an account.
          </p>
        </div>
        <LifestyleProductStage scene={scene} status={status} exploreHref={basePath} />
      </div>
      <section className="collection-browse" aria-labelledby="lifestyle-products">
        <div className="collection-browse-heading">
          <div>
            <span className="world-kicker">The collection</span>
            <h2 id="lifestyle-products">
              {browse.length ? (
                <>
                  More from the <em>assortment.</em>
                </>
              ) : (
                <>
                  Discover your <em>daily essentials.</em>
                </>
              )}
            </h2>
          </div>
          <Link className="world-text-link" href={basePath}>
            View the collection
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
        ) : browse.length ? (
          <div className="reserve-collection-grid">
            {browse.map((entry, index) => (
              <CollectionCard key={entry.handle} entry={entry} index={index} basePath={basePath} />
            ))}
          </div>
        ) : entries.length ? (
          <p className="collection-save-note">
            The opening shows the current published pieces. Open the collection to search, filter
            and compare options.
          </p>
        ) : null}
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
          Review your bag
        </Link>
      </footer>
    </div>
  );
}
