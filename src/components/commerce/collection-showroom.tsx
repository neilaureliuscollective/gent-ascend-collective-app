'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import type { CollectionEntry } from '@/domains/commerce/collection';
import { ConceptVessel } from './concept-vessel';
import { readSavedCollection } from './collection-save';
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
  const [saved, setSaved] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setSaved(readSavedCollection());
    queueMicrotask(sync);
    window.addEventListener('storage', sync);
    window.addEventListener('gent-ascend-collection-updated', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('gent-ascend-collection-updated', sync);
    };
  }, []);
  const visible = entries.filter((entry) =>
    world === 'all' || world === 'saved'
      ? world !== 'saved' || saved.includes(entry.handle)
      : entry.categories.includes(world),
  );
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
            <a href="#collection" className="world-button">
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
        <p className="reserve-collection-count" role="status">
          {visible.length} {visible.length === 1 ? 'object' : 'objects'}
          {world === 'saved' ? ' in your saved selection on this browser' : ' to explore'}
        </p>
        <div className="reserve-collection-grid">
          {visible.map((entry, index) => (
            <Link
              key={entry.handle}
              href={`/shop/${entry.handle}`}
              className="reserve-collection-card"
            >
              <div className="reserve-card-stage">
                <span className="reserve-card-number">
                  {String(index + 1).padStart(2, '0')} / {entry.brand}
                </span>
                {entry.image ? (
                  <Image
                    src={entry.image.url}
                    alt={entry.image.altText ?? entry.title}
                    width={600}
                    height={740}
                    sizes="(max-width: 560px) 90vw, (max-width: 960px) 45vw, 30vw"
                  />
                ) : (
                  <ConceptVessel title={entry.title} kind={entry.kind} brand={entry.brand} />
                )}
                <small>{entry.image ? entry.status : 'Concept packaging'}</small>
              </div>
              <div className="reserve-card-copy">
                <span className="world-kicker">
                  {entry.kind}
                  {entry.size ? ` / ${entry.size}` : ''}
                </span>
                <h3>
                  {entry.title}
                  <span aria-hidden="true">↗</span>
                </h3>
                {entry.summary && <p>{entry.summary}</p>}
                <div className="reserve-card-price">
                  <strong>{entry.price}</strong>
                  <span>{entry.status}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
        {!visible.length && (
          <div className="reserve-empty-selection">
            <h3>
              {world === 'saved'
                ? 'Your collection starts with a closer look.'
                : 'This chapter is taking shape.'}
            </h3>
            <p>
              {world === 'saved'
                ? 'Open a product and save it to keep your selection here. Saved products stay on this browser and do not reserve stock.'
                : 'Explore the other objects in the collection.'}
            </p>
            <button type="button" className="world-button" onClick={() => setWorld('all')}>
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
