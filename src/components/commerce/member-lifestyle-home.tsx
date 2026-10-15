import Link from 'next/link';
import Image from 'next/image';
import type { CollectionEntry } from '@/domains/commerce/collection';
import {
  memberCabinetPreview,
  memberCatalogDestinations,
  memberGroomingState,
  type MemberLifestyleCabinet,
} from '@/domains/commerce/member-lifestyle';
import { CollectionCard } from './collection-card';
import { LifestyleAction } from './lifestyle-action';
import { ProductPhotoFrame } from './product-photo-frame';
import { ProductMediaPending } from './product-media-pending';
import { productPath } from '@/domains/commerce/product-path';

export function MemberLifestyleHome({
  entries,
  status,
  cabinet,
}: {
  entries: CollectionEntry[];
  status: 'ready' | 'empty' | 'unconfigured' | 'error';
  cabinet: MemberLifestyleCabinet;
}) {
  const ready = status === 'ready';
  const pictured = ready ? entries.filter((entry) => entry.image) : [];
  const featured = pictured[0] ?? (ready ? entries[0] : undefined);
  const companions = (
    featured ? entries.filter((entry) => entry.handle !== featured.handle) : entries
  ).slice(0, 2);
  const destinations = memberCatalogDestinations(entries);
  const kept = memberCabinetPreview(cabinet.records);
  const grooming = memberGroomingState(cabinet);
  const browse = entries.slice(0, 6);

  return (
    <div className="reserve-commerce member-lifestyle-home">
      <header className="member-lifestyle-stage">
        <div className="member-lifestyle-copy">
          <span className="world-kicker">Aethelios Lifestyle</span>
          <h1>Your collection.</h1>
          <p>
            Authentic products, packaging and current availability — kept beside Cabinet and
            Grooming. Purchases use the same catalog; membership is not a discount or a requirement
            to order.
          </p>
          <div className="collection-entry-actions">
            <LifestyleAction className="world-button" href="/app/collection">
              Explore the collection
            </LifestyleAction>
            <LifestyleAction className="world-text-link" href="/app/collection/cabinet">
              Open Cabinet
            </LifestyleAction>
            <LifestyleAction className="world-text-link" href="/app/grooming">
              Open Grooming
            </LifestyleAction>
          </div>
          <nav className="member-lifestyle-utilities" aria-label="Shopping utilities">
            <LifestyleAction className="world-text-link" href="/app/collection/cart">
              Cart
            </LifestyleAction>
            <LifestyleAction
              className="world-text-link"
              href="/app/collection/orders"
              prefetch={false}
            >
              Orders
            </LifestyleAction>
          </nav>
        </div>
        <div className="member-lifestyle-showroom" aria-label="Collection preview">
          {status !== 'ready' ? (
            <div className="collection-empty" role="status">
              <h2>
                {status === 'error'
                  ? 'The collection could not refresh.'
                  : status === 'unconfigured'
                    ? 'Live products are not connected yet.'
                    : 'The collection is being prepared.'}
              </h2>
              <p>
                {status === 'error'
                  ? 'Current prices and availability could not be verified. Cabinet and Grooming remain available.'
                  : status === 'unconfigured'
                    ? 'Products are not available to order here until the catalog is connected.'
                    : 'No published products are available in this collection yet.'}
              </p>
              {status === 'error' && (
                <LifestyleAction className="world-button" href="/app/lifestyle">
                  Try again
                </LifestyleAction>
              )}
            </div>
          ) : featured ? (
            <>
              <FeaturedProduct entry={featured} prominence="hero" />
              {companions.length > 0 && (
                <div className="member-lifestyle-companions">
                  {companions.map((entry) => (
                    <FeaturedProduct key={entry.handle} entry={entry} prominence="companion" />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="collection-empty" role="status">
              <h2>Products are listed without photography yet.</h2>
              <p>
                Names, prices and availability remain the published catalog. Photography is
                forthcoming.
              </p>
              <LifestyleAction className="world-button" href="/app/collection">
                Browse listed products
              </LifestyleAction>
            </div>
          )}
        </div>
      </header>

      <section className="member-lifestyle-continuity" aria-labelledby="member-lifestyle-return">
        <div className="member-lifestyle-section-heading">
          <span className="world-kicker">Your environment</span>
          <h2 id="member-lifestyle-return">Cabinet and Grooming, as you left them.</h2>
        </div>
        <div className="member-lifestyle-continuity-grid">
          <article className="member-lifestyle-panel">
            <span className="world-kicker">Cabinet</span>
            <h3>What you keep.</h3>
            {!cabinet.available ? (
              <p role="status">Cabinet could not load just now. Your products were not changed.</p>
            ) : kept.length ? (
              <ul className="member-lifestyle-kept">
                {kept.map((record) => {
                  const href = record.shopify_handle
                    ? productPath(record.shopify_handle)?.replace('/shop/', '/app/collection/')
                    : null;
                  return (
                    <li key={record.id}>
                      <span>{record.label}</span>
                      {href ? (
                        <Link href={href}>{record.name}</Link>
                      ) : (
                        <strong>{record.name}</strong>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p>
                Nothing is saved yet. Saving a product keeps it on your account across devices. It
                does not place an order or mark the product as owned.
              </p>
            )}
            <LifestyleAction className="world-text-link" href="/app/collection/cabinet">
              {kept.length ? 'Return to Cabinet' : 'Open Cabinet'}
            </LifestyleAction>
          </article>
          <article className="member-lifestyle-panel">
            <span className="world-kicker">Grooming</span>
            <h3>The ritual you already keep.</h3>
            {!grooming.ready ? (
              <p role="status">Grooming records could not be confirmed from Cabinet just now.</p>
            ) : grooming.ritualCount || grooming.kept ? (
              <p>
                {grooming.ritualCount
                  ? `${grooming.ritualCount} active ${grooming.ritualCount === 1 ? 'ritual' : 'rituals'}`
                  : 'No active ritual yet'}
                {grooming.kept
                  ? ` · ${grooming.kept} ${grooming.kept === 1 ? 'product' : 'products'} marked as kept.`
                  : '.'}{' '}
                Open Grooming to continue with those existing records.
              </p>
            ) : (
              <p>
                No ritual is recorded yet. When you keep products in Cabinet, you can connect them
                to Grooming from there. Nothing is invented here.
              </p>
            )}
            <LifestyleAction className="world-text-link" href="/app/grooming">
              Open Grooming
            </LifestyleAction>
          </article>
        </div>
      </section>

      {(destinations.flagship.length > 0 ||
        destinations.brands.length > 0 ||
        destinations.chapters.length > 0) && (
        <section
          className="member-lifestyle-destinations"
          aria-labelledby="member-lifestyle-discover"
        >
          <div className="member-lifestyle-section-heading">
            <span className="world-kicker">In this catalog</span>
            <h2 id="member-lifestyle-discover">Brands and categories that are actually here.</h2>
          </div>
          <div className="member-lifestyle-destination-list">
            {destinations.flagship.map((brand) => (
              <LifestyleAction
                key={brand.slug}
                className="member-lifestyle-destination"
                href={`/app/lifestyle/${brand.slug}`}
              >
                {brand.name}
              </LifestyleAction>
            ))}
            {destinations.brands
              .filter((brand) => !destinations.flagship.some((entry) => entry.name === brand))
              .map((brand) => (
                <LifestyleAction
                  key={brand}
                  className="member-lifestyle-destination"
                  href={`/app/collection?brand=${encodeURIComponent(brand)}`}
                >
                  {brand}
                </LifestyleAction>
              ))}
            {destinations.chapters.map(([id, label]) => (
              <LifestyleAction
                key={id}
                className="member-lifestyle-destination"
                href={`/app/collection?chapter=${id}`}
              >
                {label}
              </LifestyleAction>
            ))}
          </div>
        </section>
      )}

      {ready && browse.length > 0 && (
        <section
          className="collection-browse member-lifestyle-browse"
          aria-labelledby="member-lifestyle-products"
        >
          <div className="collection-browse-heading">
            <div>
              <span className="world-kicker">The collection</span>
              <h2 id="member-lifestyle-products">Inspect the products themselves.</h2>
            </div>
            <LifestyleAction className="world-text-link" href="/app/collection">
              View the full collection
            </LifestyleAction>
          </div>
          <div className="reserve-collection-grid member-lifestyle-grid">
            {browse.map((entry, index) => (
              <CollectionCard
                key={entry.handle}
                entry={entry}
                index={index}
                basePath="/app/collection"
                prominence={
                  index === 0 && entry.image ? 'featured' : index < 3 ? 'editorial' : 'standard'
                }
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function FeaturedProduct({
  entry,
  prominence,
}: {
  entry: CollectionEntry;
  prominence: 'hero' | 'companion';
}) {
  return (
    <Link
      href={`/app/collection/${entry.handle}`}
      className={`member-lifestyle-product member-lifestyle-product--${prominence}`}
    >
      <div className="member-lifestyle-product-well">
        {entry.image ? (
          <ProductPhotoFrame>
            <Image
              src={entry.image.url}
              alt={entry.image.altText ?? entry.title}
              width={entry.image.width ?? 800}
              height={entry.image.height ?? 1000}
              sizes={
                prominence === 'hero'
                  ? '(max-width: 700px) 86vw, 48vw'
                  : '(max-width: 700px) 42vw, 22vw'
              }
              preload={prominence === 'hero'}
            />
          </ProductPhotoFrame>
        ) : (
          <ProductMediaPending title={entry.title} />
        )}
      </div>
      <span>
        <strong>{entry.title}</strong>
        <small>
          {entry.brand} · {entry.price} · {entry.status}
        </small>
      </span>
    </Link>
  );
}
