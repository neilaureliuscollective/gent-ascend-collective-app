'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { CollectionEntry } from '@/domains/commerce/collection';
import { filterCatalog } from '@/domains/commerce/catalog-filter';
import { CollectionCard } from './collection-card';
import { CollectionDiscovery } from './collection-discovery';
import { useSavedCollection, removeSavedCollection } from './saved-selection-store';

const chapters = [
  ['all', 'All essentials'],
  ['grooming', 'Grooming'],
  ['performance', 'Performance'],
  ['recovery', 'Recovery'],
  ['daily-ritual', 'Daily ritual'],
  ['saved', 'My selection'],
] as const;
const basePath = '/app/collection';
export function CollectionWorld({
  entries,
  failed,
  savedOnly = false,
  brand,
  catalogStatus = 'ready',
}: {
  entries: CollectionEntry[];
  failed: boolean;
  savedOnly?: boolean;
  brand?: string;
  catalogStatus?: 'ready' | 'empty' | 'unconfigured' | 'error';
}) {
  const [chapter, setChapter] = useState(savedOnly ? 'saved' : 'all');
  const [query, setQuery] = useState('');
  const [readyOnly, setReadyOnly] = useState(false);
  const [notice, setNotice] = useState('');
  const saved = useSavedCollection();
  const candidates = entries.filter(
    (entry) =>
      chapter === 'all' ||
      (chapter === 'saved' ? saved.includes(entry.handle) : entry.categories.includes(chapter)),
  );
  const visible = filterCatalog(candidates, query, readyOnly);
  const missing =
    chapter === 'saved'
      ? saved.filter((handle) => !entries.some((entry) => entry.handle === handle))
      : [];
  function reset() {
    setQuery('');
    setReadyOnly(false);
    setChapter('all');
  }
  return (
    <div className="reserve-commerce collection-world">
      <header className="collection-chamber">
        <div className="collection-chamber-copy">
          <span className="world-kicker">AETHELIOS LIFESTYLE / Your daily standard</span>
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
            Grooming. Personal care. Daily ritual.
            <br />
            Find what earns a place in your day.
          </p>
          <div className="collection-entry-actions">
            <a className="world-button" href="#collection">
              Explore essentials
            </a>
            <Link className="world-text-link" href={`${basePath}/cart`}>
              Your cart
            </Link>
            <Link className="world-text-link" href={`${basePath}/cabinet`}>
              Your Cabinet
            </Link>
            <Link className="world-text-link" href={`${basePath}/orders`} prefetch={false}>
              Your orders
            </Link>
          </div>
        </div>
        <div className="collection-chamber-caption" aria-hidden="true">
          <span>CARE / DISCIPLINE / RITUAL</span>
          <span>THE HUMAN ASCENDANCE</span>
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
          <Link href="/app/grooming" className="world-text-link">
            Your grooming routine
          </Link>
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
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label className="collection-availability">
            <input
              type="checkbox"
              checked={readyOnly}
              onChange={(event) => setReadyOnly(event.target.checked)}
            />
            Available to order
          </label>
        </div>
        <div className="collection-chapters" role="group" aria-label="Collection chapters">
          {chapters
            .filter(
              ([id]) =>
                id === 'all' ||
                id === 'saved' ||
                entries.some((entry) => entry.categories.includes(id)),
            )
            .map(([id, label]) => (
              <button key={id} aria-pressed={chapter === id} onClick={() => setChapter(id)}>
                {label}
                {id === 'saved' && saved.length ? ` (${saved.length})` : ''}
              </button>
            ))}
        </div>
        <div className="collection-results">
          <p role="status">
            {visible.length} {visible.length === 1 ? 'essential' : 'essentials'}
            {chapter === 'saved' ? ' in your selection' : ' to explore'}
          </p>
          {(query || readyOnly || chapter !== 'all') && (
            <button onClick={reset}>Show all essentials</button>
          )}
        </div>
        {chapter === 'saved' && (
          <p className="collection-save-note">
            Your selection is saved on this browser. It does not reserve stock or place an order.{' '}
            <Link href={`${basePath}/cabinet`}>Review it for your synced Cabinet →</Link>
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
            />
          ))}
        </div>
        {!visible.length && (
          <div className="collection-empty">
            <h3>
              {chapter === 'saved' && !query && !readyOnly
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
            <button className="world-button" onClick={reset}>
              Explore all essentials
            </button>
          </div>
        )}
      </section>
      <CollectionDiscovery entries={entries} basePath={basePath} />
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
          <Link href="/app/lifestyle" className="world-button">
            Aethelios Lifestyle
          </Link>
          <Link href="/app/membership" className="world-text-link">
            Your membership
          </Link>
        </div>
      </footer>
    </div>
  );
}
