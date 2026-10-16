'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useCatalogNavigation } from './catalog-navigation';
import type { CollectionEntry } from '@/domains/commerce/collection';
import { filterCatalog } from '@/domains/commerce/catalog-filter';
import { CollectionCard } from './collection-card';
import { CollectionDiscovery } from './collection-discovery';
import { useSavedCollection, removeSavedCollection } from './saved-selection-store';
import { LifestyleAction } from './lifestyle-action';
import { CatalogScrollRestore } from './catalog-scroll-restore';

const chapters = [
  ['all', 'All essentials'],
  ['grooming', 'Grooming'],
  ['performance', 'Performance'],
  ['recovery', 'Recovery'],
  ['daily-ritual', 'Daily ritual'],
  ['saved', 'My selection'],
] as const;
export function CollectionWorld({
  entries,
  basePath = '/app/collection',
  failed,
  savedOnly = false,
  brand,
  catalogStatus = 'ready',
}: {
  basePath?: string;
  entries: CollectionEntry[];
  failed: boolean;
  savedOnly?: boolean;
  brand?: string;
  catalogStatus?: 'ready' | 'empty' | 'unconfigured' | 'error';
}) {
  const [notice, setNotice] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const brands = [...new Set(entries.map((entry) => entry.brand))].sort();
  const priceSortSupported =
    new Set(
      entries.filter((entry) => entry.priceAmount !== undefined).map((entry) => entry.currency),
    ).size === 1;
  const availableChapters = chapters.filter(
    ([id]) =>
      id === 'all' || id === 'saved' || entries.some((entry) => entry.categories.includes(id)),
  );
  const {
    view: { chapter, query, readyOnly, sort, brandFilter },
    update,
  } = useCatalogNavigation(
    availableChapters.map(([id]) => id),
    brands,
    priceSortSupported,
    savedOnly,
  );
  const saved = useSavedCollection();
  const candidates = entries.filter(
    (entry) =>
      chapter === 'all' ||
      (chapter === 'saved' ? saved.includes(entry.handle) : entry.categories.includes(chapter)),
  );
  const visible = filterCatalog(candidates, query, readyOnly)
    .filter((entry) => brandFilter === 'all' || entry.brand === brandFilter)
    .sort((a, b) => {
      if (sort === 'name') return a.title.localeCompare(b.title);
      if (!priceSortSupported || !['price-asc', 'price-desc'].includes(sort)) return 0;
      if (!Number.isFinite(a.priceAmount)) return Number.isFinite(b.priceAmount) ? 1 : 0;
      if (!Number.isFinite(b.priceAmount)) return -1;
      return (a.priceAmount! - b.priceAmount!) * (sort === 'price-asc' ? 1 : -1);
    });
  const missing =
    chapter === 'saved'
      ? saved.filter((handle) => !entries.some((entry) => entry.handle === handle))
      : [];
  function reset() {
    update({ query: '', readyOnly: false, chapter: 'all', brandFilter: 'all', sort: 'featured' });
  }
  const member = basePath === '/app/collection';
  const activeFilterCount =
    Number(Boolean(query)) +
    Number(readyOnly) +
    Number(chapter !== 'all') +
    Number(brandFilter !== 'all') +
    Number(sort !== 'featured');
  return (
    <div
      className={`reserve-commerce collection-world${member ? ' member-lifestyle-collection' : ''}`}
    >
      {member ? <CatalogScrollRestore /> : null}
      <header className="collection-chamber">
        <div className="collection-chamber-copy">
          <span className="world-kicker">
            {member
              ? 'Aethelios Lifestyle / Collection'
              : 'AETHELIOS LIFESTYLE / Your daily standard'}
          </span>
          <h1>
            {brand ? (
              <>
                {brand}
                <em>.</em>
              </>
            ) : (
              <>
                The <em>Collection.</em>
              </>
            )}
          </h1>
          <p>
            {member ? (
              'Search and filter the catalog. Cabinet and Grooming stay in reach; cart and orders stay utilities.'
            ) : (
              <>
                Grooming. Personal care. Daily ritual.
                <br />
                Find what earns a place in your day.
              </>
            )}
          </p>
          <div className="collection-entry-actions">
            <a className="world-button" href="#collection">
              Explore essentials
            </a>
            {member ? (
              <>
                <LifestyleAction className="world-text-link" href="/app/collection/cabinet">
                  Your Cabinet
                </LifestyleAction>
                <LifestyleAction className="world-text-link" href="/app/grooming">
                  Grooming
                </LifestyleAction>
                <LifestyleAction className="world-text-link" href={`${basePath}/cart`}>
                  Cart
                </LifestyleAction>
                <LifestyleAction
                  className="world-text-link"
                  href="/app/collection/orders"
                  prefetch={false}
                >
                  Orders
                </LifestyleAction>
              </>
            ) : (
              <>
                <Link className="world-text-link" href={`${basePath}/cart`}>
                  Your cart
                </Link>
                <Link className="world-text-link" href="/app/collection/cabinet">
                  Your Cabinet
                </Link>
                <Link className="world-text-link" href="/app/collection/orders" prefetch={false}>
                  Your orders
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <section id="collection" className="collection-browse" aria-labelledby="collection-heading">
        <div className="collection-browse-heading">
          <div>
            <span className="world-kicker">The essentials</span>
            <h2 id="collection-heading">
              Choose your <em>standard.</em>
            </h2>
          </div>
          {member ? (
            <LifestyleAction href="/app/grooming" className="world-text-link">
              Your grooming routine
            </LifestyleAction>
          ) : (
            <Link href="/app/grooming" className="world-text-link">
              Your grooming routine
            </Link>
          )}
        </div>
        {failed && (
          <p className="preview-notice" role="status">
            Live products are temporarily unavailable. Current prices and availability could not be
            verified. <button onClick={() => window.location.reload()}>Try again</button>
          </p>
        )}
        {catalogStatus === 'unconfigured' && (
          <p className="preview-notice" role="status">
            Live product availability is not connected yet. Products are not available to order
            here.
          </p>
        )}
        <div className="collection-search-row">
          <label htmlFor="collection-search">
            Find your essential
            <input
              id="collection-search"
              type="search"
              placeholder="Search products or rituals"
              value={query}
              maxLength={120}
              onChange={(event) => update({ query: event.target.value }, true)}
            />
          </label>
          <label className="collection-availability">
            <input
              type="checkbox"
              checked={readyOnly}
              onChange={(event) => update({ readyOnly: event.target.checked })}
            />
            Available to order
          </label>
          <div className="collection-filter-toolbar">
            <button
              type="button"
              className="collection-filter-toggle"
              aria-expanded={filtersOpen}
              aria-controls="collection-filter-panel"
              onClick={() => setFiltersOpen((open) => !open)}
            >
              Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}
            </button>
            {activeFilterCount > 0 && (
              <button type="button" className="collection-filter-reset" onClick={reset}>
                Reset filters
              </button>
            )}
          </div>
        </div>
        <div
          id="collection-filter-panel"
          className={`collection-filter-panel${filtersOpen ? ' is-open' : ''}`}
        >
          <label>
            Sort products
            <select value={sort} onChange={(event) => update({ sort: event.target.value })}>
              <option value="featured">Catalog order</option>
              <option value="name">Name: A–Z</option>
              {priceSortSupported && <option value="price-asc">Price: low to high</option>}
              {priceSortSupported && <option value="price-desc">Price: high to low</option>}
            </select>
          </label>
          {brands.length > 1 && (
            <label>
              Brand
              <select
                value={brandFilter}
                onChange={(event) => update({ brandFilter: event.target.value })}
              >
                <option value="all">All brands</option>
                {brands.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="collection-chapters" role="group" aria-label="Collection chapters">
          {availableChapters.map(([id, label]) => (
            <button key={id} aria-pressed={chapter === id} onClick={() => update({ chapter: id })}>
              {label}
              {id === 'saved' && saved.length ? ` (${saved.length})` : ''}
            </button>
          ))}
        </div>
        {(query || readyOnly || chapter !== 'all' || brandFilter !== 'all') && (
          <div className="collection-chapters" role="group" aria-label="Applied filters">
            {query && (
              <button onClick={() => update({ query: '' })}>Remove search: {query} ×</button>
            )}
            {readyOnly && (
              <button onClick={() => update({ readyOnly: false })}>
                Remove available to order ×
              </button>
            )}
            {chapter !== 'all' && (
              <button onClick={() => update({ chapter: 'all' })}>
                Remove {availableChapters.find(([id]) => id === chapter)?.[1]} ×
              </button>
            )}
            {brandFilter !== 'all' && (
              <button onClick={() => update({ brandFilter: 'all' })}>
                Remove brand: {brandFilter} ×
              </button>
            )}
          </div>
        )}
        <div className="collection-results">
          <p role="status">
            {visible.length} {visible.length === 1 ? 'essential' : 'essentials'}
            {chapter === 'saved' ? ' in your selection' : ' to explore'}
          </p>
          {(query ||
            readyOnly ||
            chapter !== 'all' ||
            brandFilter !== 'all' ||
            sort !== 'featured') && <button onClick={reset}>Show all essentials</button>}
        </div>
        {chapter === 'saved' && (
          <p className="collection-save-note">
            Your selection is saved on this browser. It does not reserve stock or place an order.{' '}
            {member ? (
              <LifestyleAction href="/app/collection/cabinet" className="world-text-link">
                Review it for your synced Cabinet
              </LifestyleAction>
            ) : (
              <Link href={'/app/collection/cabinet'}>Review it for your synced Cabinet →</Link>
            )}
          </p>
        )}
        {missing.map((handle) => (
          <div key={handle} className="collection-save-note">
            {handle} is not in the current catalog.{' '}
            <button
              onClick={() => {
                try {
                  removeSavedCollection(handle);
                  setNotice('Removed from your selection.');
                } catch {
                  setNotice('Your selection could not be updated. Please try again.');
                }
              }}
            >
              Remove {handle}
            </button>
          </div>
        ))}
        {notice && <p role="status">{notice}</p>}
        <div className="reserve-collection-grid">
          {visible.map((entry, index) => (
            <CollectionCard
              key={entry.handle}
              entry={entry}
              index={index}
              basePath={basePath}
              review={chapter === 'saved'}
              prominence="standard"
            />
          ))}
        </div>
        {!visible.length && (
          <div className="collection-empty">
            <h3>
              {!entries.length && brand
                ? `${brand} is being prepared.`
                : chapter === 'saved' && !query && !readyOnly
                  ? 'Keep what catches your eye.'
                  : 'No essentials match this view.'}
            </h3>
            <p>
              {chapter === 'saved'
                ? 'Save a product from its page to revisit it here.'
                : entries.length
                  ? 'Try another search or include unavailable products.'
                  : 'No published products are available in this collection yet.'}
            </p>
            {entries.length ? (
              <button className="world-button" onClick={reset}>
                Explore all essentials
              </button>
            ) : brand ? (
              <LifestyleAction className="world-button" href={basePath}>
                Explore Aethelios Lifestyle
              </LifestyleAction>
            ) : null}
          </div>
        )}
      </section>
      {entries.some((entry) => entry.discovery?.length) && (
        <CollectionDiscovery entries={entries} basePath={basePath} />
      )}
      <footer className="collection-world-footer">
        <span className="world-kicker">The practice behind the product</span>
        <h2>
          A place in your day.
          <br />
          <em>A standard you return to.</em>
        </h2>
        <p>
          Explore verified product details, options and availability on each product page. Product
          purchases do not require a paid membership.
        </p>
        <div className="collection-entry-actions">
          <LifestyleAction
            href={basePath === '/shop' ? '/lifestyle' : '/app/lifestyle'}
            className="world-button"
          >
            Aethelios Lifestyle
          </LifestyleAction>
          {member ? (
            <>
              <LifestyleAction className="world-text-link" href="/app/collection/cabinet">
                Cabinet
              </LifestyleAction>
              <LifestyleAction className="world-text-link" href={`${basePath}/cart`}>
                Cart
              </LifestyleAction>
            </>
          ) : (
            <>
              <Link href="/app/collection/cabinet" className="world-text-link">
                Your Cabinet
              </Link>
              <Link href="/app/membership" className="world-text-link">
                Your membership
              </Link>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}
