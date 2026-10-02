'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import type { CollectionEntry } from '@/domains/commerce/collection';
import { ConceptVessel } from './concept-vessel';
import { useSavedCollection, removeSavedCollection } from './saved-selection-store';
import { CollectionDiscovery } from './collection-discovery';
import { CollectionCard } from './collection-card';
import { filterCatalog } from '@/domains/commerce/catalog-filter';
const worlds = [
  ['all', 'The collection'],
  ['grooming', 'Grooming'],
  ['performance', 'Performance'],
  ['recovery', 'Recovery'],
  ['daily-ritual', 'Daily ritual'],
  ['saved', 'My selection'],
] as const;
export function CollectionShowroom({
  entries,
  failed = false,
  title = 'The founding collection',
  fixedWorld,
  savedOnly = false,
}: {
  entries: CollectionEntry[];
  failed?: boolean;
  title?: string;
  fixedWorld?: string;
  savedOnly?: boolean;
}) {
  const [world, setWorld] = useState(savedOnly ? 'saved' : (fixedWorld ?? 'all'));
  const saved = useSavedCollection();
  const [selectionMessage, setSelectionMessage] = useState('');
  const [query, setQuery] = useState('');
  const [readyOnly, setReadyOnly] = useState(false);
  const missing = saved.filter((handle) => !entries.some((entry) => entry.handle === handle));
  const chapter = entries.filter((entry) =>
    world === 'all' || world === 'saved'
      ? world !== 'saved' || saved.includes(entry.handle)
      : entry.categories.includes(world),
  );
  const visible = filterCatalog(chapter, query, readyOnly);
  const featured = entries[0];
  return (
    <>
      <header className="reserve-shop-hero">
        <div className="reserve-shop-headline">
          <span className="world-kicker">Gent Ascend Collective / {title}</span>
          <h1>
            A higher
            <br />
            daily <em>standard.</em>
          </h1>
          <p>
            Considered grooming. Deliberate performance. Explore the objects and the practice behind
            them.
          </p>
          <div className="world-actions">
            <a href={savedOnly ? '#collection' : '#discovery'} className="world-button">
              Find your next essential ↓
            </a>
            <Link href="/membership" className="world-text-link">
              Explore membership ↗
            </Link>
          </div>
        </div>
        {featured && (
          <Link
            className="reserve-hero-object"
            href={`/shop/${featured.handle}`}
            aria-label={`Discover ${featured.title}`}
          >
            <span className="reserve-hero-coordinate">{featured.brand} / 001</span>
            <div className="reserve-stage-rings" aria-hidden="true" />
            {featured.image ? (
              <Image
                src={featured.image.url}
                alt={featured.image.altText ?? featured.title}
                width={700}
                height={850}
                sizes="(max-width: 760px) 85vw, 42vw"
                preload
              />
            ) : (
              <ConceptVessel title={featured.title} kind={featured.kind} brand={featured.brand} />
            )}
            <div className="reserve-hero-object-caption">
              <span>{featured.image ? 'THE FIRST CHAPTER' : 'CONCEPT PACKAGING'}</span>
              <strong>{featured.title} ↗</strong>
            </div>
          </Link>
        )}
      </header>
      {!savedOnly && <CollectionDiscovery entries={entries} />}
      <section id="collection" className="reserve-shelf-section">
        <div className="reserve-shelf-heading">
          <div>
            <span className="world-kicker">Objects for the daily ritual</span>
            <h2>
              Build your <em>collection.</em>
            </h2>
          </div>
          <p>
            Explore the formula. Understand the fit.
            <br />
            Choose what earns a place in your day.
          </p>
        </div>
        {failed && (
          <p role="status" className="preview-notice">
            The live collection is temporarily unavailable. The objects below are previews; orders
            are not open for them.
          </p>
        )}
        <div className="reserve-collection-filters" role="group" aria-label="Filter the collection">
          {worlds
            .filter(
              ([id]) =>
                id === 'all' ||
                id === 'saved' ||
                entries.some((entry) => entry.categories.includes(id)),
            )
            .map(([id, name]) => (
              <button
                type="button"
                key={id}
                aria-pressed={world === id}
                onClick={() => setWorld(id)}
              >
                {name}
                {id === 'saved' && saved.length > 0 ? ` (${saved.length})` : ''}
              </button>
            ))}
        </div>
        <div className="reserve-catalog-tools">
          <label>
            Search this collection
            <input
              type="search"
              value={query}
              maxLength={120}
              placeholder="Name, product or ritual"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label className="reserve-ready-filter">
            <input
              type="checkbox"
              checked={readyOnly}
              onChange={(event) => setReadyOnly(event.target.checked)}
            />
            Available to order
          </label>
          {(query || readyOnly) && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setReadyOnly(false);
              }}
            >
              Clear search & availability
            </button>
          )}
        </div>
        <p className="reserve-collection-count" role="status">
          {visible.length} {visible.length === 1 ? 'object' : 'objects'}
          {world === 'saved' ? ' in your saved selection on this browser' : ' to explore'}
        </p>
        {world === 'saved' && (
          <div className="reserve-selection-intro">
            <h3>Your collection, considered.</h3>
            <p>
              Review the purpose, texture, scent, and availability of each object. Open its product
              page to check ingredients, cautions, and the exact option before purchasing.
            </p>
            <p>
              Saved on this browser. This is not a cart, reservation, release alert, or
              account-synced collection.
            </p>
            {missing.length > 0 && (
              <div className="reserve-unresolved-selection">
                <p>
                  {missing.length} saved {missing.length === 1 ? 'item is' : 'items are'} not in
                  this collection view. Availability has not been confirmed.
                </p>
                {missing.map((handle) => (
                  <div key={handle}>
                    <span>{handle}</span>
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          removeSavedCollection(handle);
                          setSelectionMessage('Removed from your saved selection.');
                        } catch {
                          setSelectionMessage(
                            'Storage is unavailable. Your saved selection could not be changed.',
                          );
                        }
                      }}
                    >
                      Remove {handle}
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p role="status">{selectionMessage}</p>
          </div>
        )}
        <div className="reserve-collection-grid">
          {visible.map((entry, index) => (
            <CollectionCard
              key={entry.handle}
              entry={entry}
              index={index}
              review={world === 'saved'}
            />
          ))}
        </div>
        {!visible.length && (
          <div className="reserve-empty-selection">
            <h3>
              {query || readyOnly
                ? 'No objects match these filters.'
                : world === 'saved'
                  ? 'Your collection starts with a closer look.'
                  : 'This chapter is taking shape.'}
            </h3>
            <p>
              {query || readyOnly
                ? 'Clear the search or include previews to explore more of this chapter. Your saved selection has not changed.'
                : world === 'saved'
                  ? 'Open a product and save it to keep your selection here. Saved products stay on this browser and do not reserve stock.'
                  : 'Explore the other objects in the collection.'}
            </p>
            <button
              type="button"
              className="world-button"
              onClick={() => {
                setWorld('all');
                setQuery('');
                setReadyOnly(false);
              }}
            >
              Explore the collection ↗
            </button>
          </div>
        )}
      </section>
      <section className="reserve-shop-manifesto">
        <span className="world-kicker">The Legacy Reserve standard</span>
        <h2>
          More than a place
          <br />
          <em>on the shelf.</em>
        </h2>
        <p>
          Every product deserves a clear purpose, a considered ritual, and information you can
          inspect. Discover what is ready and what is being developed.
        </p>
        <Link href="/about" className="world-text-link">
          The story behind the Collective ↗
        </Link>
      </section>
    </>
  );
}
