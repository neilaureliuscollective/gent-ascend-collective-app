import Link from 'next/link';
import {
  memberCabinetPreview,
  memberCatalogDestinations,
  memberGroomingState,
  type MemberLifestyleCabinet,
} from '@/domains/commerce/member-lifestyle';
import {
  lifestyleBrowseEntries,
  resolveLifestyleScene,
  type CatalogStatus,
} from '@/domains/commerce/lifestyle-merchandising';
import type { CollectionEntry } from '@/domains/commerce/collection';
import { CollectionCard } from './collection-card';
import { LifestyleAction } from './lifestyle-action';
import { LifestyleProductStage } from './lifestyle-product-stage';
import { productPath } from '@/domains/commerce/product-path';

export function MemberLifestyleHome({
  entries,
  status,
  cabinet,
}: {
  entries: CollectionEntry[];
  status: CatalogStatus;
  cabinet: MemberLifestyleCabinet;
}) {
  const scene = resolveLifestyleScene(entries, { basePath: '/app/collection', status });
  const destinations = memberCatalogDestinations(entries);
  const kept = memberCabinetPreview(cabinet.records);
  const grooming = memberGroomingState(cabinet);
  const browse = lifestyleBrowseEntries(entries, scene);

  return (
    <div className="reserve-commerce member-lifestyle-home lifestyle-world">
      <header className="member-lifestyle-masthead">
        <div className="member-lifestyle-copy">
          <span className="world-kicker">Aethelios Lifestyle</span>
          <h1>Your collection.</h1>
          <p>Products for the day you keep — Cabinet, Grooming and the catalog in one place.</p>
        </div>
        <nav className="member-lifestyle-utilities" aria-label="Shopping utilities">
          <LifestyleAction className="world-text-link" href="/app/collection/cabinet">
            Open Cabinet
          </LifestyleAction>
          <LifestyleAction className="world-text-link" href="/app/grooming">
            Open Grooming
          </LifestyleAction>
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
      </header>

      <LifestyleProductStage scene={scene} status={status} exploreHref="/app/collection" />

      {status === 'error' && (
        <p className="member-lifestyle-retry">
          <LifestyleAction className="world-button" href="/app/lifestyle">
            Try again
          </LifestyleAction>
        </p>
      )}

      <section className="member-lifestyle-continuity" aria-labelledby="member-lifestyle-return">
        <div className="member-lifestyle-section-heading">
          <span className="world-kicker">With you</span>
          <h2 id="member-lifestyle-return">Cabinet and Grooming.</h2>
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
                Nothing is saved yet. Save a product to keep it on your account. Saving is not an
                order and does not mark it owned.
              </p>
            )}
            <LifestyleAction className="world-text-link" href="/app/collection/cabinet">
              {kept.length ? 'Return to Cabinet' : 'Open Cabinet'}
            </LifestyleAction>
          </article>
          <article className="member-lifestyle-panel">
            <span className="world-kicker">Grooming</span>
            <h3>The ritual you keep.</h3>
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
                No ritual is recorded yet. Kept Cabinet products can be connected from Grooming.
              </p>
            )}
            <LifestyleAction className="world-text-link" href="/app/grooming">
              Open Grooming
            </LifestyleAction>
          </article>
        </div>
      </section>

      {(destinations.brands.length > 0 || destinations.chapters.length > 0) && (
        <section
          className="member-lifestyle-destinations"
          aria-labelledby="member-lifestyle-discover"
        >
          <div className="member-lifestyle-section-heading">
            <span className="world-kicker">Find a piece</span>
            <h2 id="member-lifestyle-discover">Shop by ritual.</h2>
          </div>
          <div className="member-lifestyle-destination-list">
            {destinations.chapters.map(([id, label]) => (
              <LifestyleAction
                key={id}
                className="member-lifestyle-destination"
                href={`/app/collection?chapter=${id}`}
              >
                {label}
              </LifestyleAction>
            ))}
            {destinations.brands.map((brandName) => (
              <LifestyleAction
                key={brandName}
                className="member-lifestyle-destination"
                href={`/app/collection?brand=${encodeURIComponent(brandName)}`}
              >
                {brandName}
              </LifestyleAction>
            ))}
          </div>
        </section>
      )}

      {status === 'ready' && browse.length > 0 && (
        <section
          className="collection-browse member-lifestyle-browse"
          aria-labelledby="member-lifestyle-products"
        >
          <div className="collection-browse-heading">
            <div>
              <span className="world-kicker">The catalog</span>
              <h2 id="member-lifestyle-products">Available now.</h2>
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
                prominence="standard"
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
