'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import type { CollectionEntry } from '@/domains/commerce/collection';
import {
  discoveryFocus,
  discoverCollection,
  discoveryReason,
  type DiscoveryFocus,
  type DiscoveryAvailability,
} from '@/domains/commerce/discovery';
import { CollectionCard } from './collection-card';
import { commerceEvent } from './commerce-events';

export function CollectionDiscovery({ entries }: { entries: CollectionEntry[] }) {
  const [focus, setFocus] = useState<DiscoveryFocus>('all');
  const [availability, setAvailability] = useState<DiscoveryAvailability>('all');
  const [searched, setSearched] = useState(false);
  const results = useRef<HTMLHeadingElement>(null);
  const matches = discoverCollection(entries, focus, availability);
  function submit() {
    setSearched(true);
    commerceEvent('discovery_complete');
    requestAnimationFrame(() => results.current?.focus());
  }
  function changeFocus(value: DiscoveryFocus) {
    setFocus(value);
    setSearched(false);
  }
  return (
    <section id="discovery" className="reserve-discovery" aria-labelledby="discovery-title">
      <div className="reserve-discovery-intro">
        <span className="world-kicker">Your collection / A deliberate beginning</span>
        <h2 id="discovery-title">
          Begin with
          <br />
          <em>your intention.</em>
        </h2>
        <p>
          Choose a chapter. See what is ready and what is taking shape. Keep the objects that
          interest you.
        </p>
        <small>Optional collection guide. No account or email required.</small>
      </div>
      <div className="reserve-discovery-controls">
        <fieldset>
          <legend>01 / What would you like to explore?</legend>
          <div className="reserve-intention-options">
            {discoveryFocus.map((option) => (
              <label key={option.id} data-selected={focus === option.id}>
                <input
                  type="radio"
                  name="focus"
                  value={option.id}
                  checked={focus === option.id}
                  onChange={() => changeFocus(option.id)}
                />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.detail}</small>
                </span>
                <span aria-hidden="true">{focus === option.id ? '◆' : '◇'}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>02 / What would you like to see?</legend>
          <div className="reserve-availability-options">
            <label>
              <input
                type="radio"
                name="availability"
                checked={availability === 'all'}
                onChange={() => {
                  setAvailability('all');
                  setSearched(false);
                }}
              />
              Ready products & previews
            </label>
            <label>
              <input
                type="radio"
                name="availability"
                checked={availability === 'ready'}
                onChange={() => {
                  setAvailability('ready');
                  setSearched(false);
                }}
              />
              Available to order
            </label>
          </div>
        </fieldset>
        <button className="world-button" type="button" onClick={submit}>
          Explore my direction ↓
        </button>
        <p className="reserve-discovery-disclosure">
          This filters the collection by category and availability. It does not assess your skin,
          health, or product compatibility. Performance products remain in the full collection.
        </p>
      </div>
      {searched && (
        <div className="reserve-discovery-results">
          <h3 ref={results} tabIndex={-1}>
            Your direction: {discoveryFocus.find((option) => option.id === focus)?.label}
          </h3>
          <p role="status">
            {matches.length} {matches.length === 1 ? 'object' : 'objects'}
            {availability === 'ready' ? ' available to order' : ' to explore'}. This is a starting
            point, not a prescribed routine.
          </p>
          {matches.length ? (
            <div className="reserve-collection-grid">
              {matches.map((entry, index) => (
                <CollectionCard
                  key={entry.handle}
                  entry={entry}
                  index={index}
                  reason={discoveryReason(entry, focus)}
                />
              ))}
            </div>
          ) : (
            <div className="reserve-empty-selection">
              <h4>
                {availability === 'ready'
                  ? 'This direction is not open for ordering yet.'
                  : 'This chapter is still taking shape.'}
              </h4>
              <p>
                Explore previews or change your direction. We will not substitute an unrelated
                product.
              </p>
              {availability === 'ready' && (
                <button
                  className="world-button"
                  type="button"
                  onClick={() => {
                    setAvailability('all');
                    commerceEvent('discovery_complete');
                  }}
                >
                  Include previews
                </button>
              )}
            </div>
          )}
          <Link className="world-text-link" href="/shop?saved=1">
            Review my saved selection ↗
          </Link>
        </div>
      )}
      <noscript>
        <p>
          The interactive guide needs JavaScript. You can explore every product in the collection
          below.
        </p>
      </noscript>
    </section>
  );
}
