'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { track } from '@/domains/onboarding/track';
import { requestAccountClaim } from '@/domains/onboarding/entry';
import { worlds } from '@/platform/world/registry';
import { ContextSheet } from '@/components/interaction/context-sheet';
import { useWorldPriority, WorldPrioritySummary, WorldPriorityEditor } from './world-priority';
import { WorldPresence, WorldScenery, useWorldAtmosphere } from './world-atmosphere';

const connections = [
  'M170 155 Q120 115 54 72',
  'M170 155 Q220 115 286 72',
  'M170 155 Q120 195 54 242',
  'M170 155 Q220 195 286 242',
];

export function WholeManWorld({ initialWorld = null }: { initialWorld?: string | null }) {
  const params = useSearchParams();
  const selected = Math.max(
    0,
    worlds.findIndex((world) => world.id === (params.get('world') ?? initialWorld)),
  );
  const world = worlds[selected]!;
  const [directory, setDirectory] = useState(false);
  const [direction, setDirection] = useState(false);
  const priority = useWorldPriority(direction);
  const { ref: sceneRef, moving, solid, saveData } = useWorldAtmosphere();
  useEffect(() => {
    const sync = () => {
      if (window.location.hash === '#direction') setDirection(true);
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  useEffect(() => {
    const claiming = () => {
      setDirection(false);
      const url = new URL(window.location.href);
      if (url.hash === '#direction') {
        url.hash = '';
        window.history.replaceState(null, '', url);
      }
    };
    window.addEventListener('gent-claim-account', claiming);
    return () => window.removeEventListener('gent-claim-account', claiming);
  }, []);
  function select(index: number) {
    track('preview_engaged');
    const url = new URL(window.location.href);
    url.searchParams.set('world', worlds[index]!.id);
    // Next's native history integration retains selection across refresh/back without a server fetch.
    window.history.replaceState(null, '', url);
  }
  function closeDirection() {
    setDirection(false);
    if (window.location.hash === '#direction') {
      const url = new URL(window.location.href);
      url.hash = '';
      window.history.replaceState(null, '', url);
    }
  }
  return (
    <>
      <section
        className="gw-atlas"
        aria-labelledby="world-heading"
        ref={sceneRef}
        data-world={world.id}
        data-solid={solid}
        data-save-data={saveData}
      >
        <WorldScenery world={world} saveData={saveData} />
        <div className="gw-atlas-intro">
          <p className="gw-kicker">GENT ASCEND / WHOLE MAN</p>
          <h1 id="world-heading" tabIndex={-1}>
            One life.
            <br />
            <em>Your world.</em>
          </h1>
          <p>Choose what you want to build.</p>
        </div>
        <div className="gw-constellation">
          <div className="gw-orbit-plane" aria-hidden="true">
            <div />
            <div />
          </div>
          <svg
            className="gw-world-connections"
            viewBox="0 0 340 310"
            fill="none"
            aria-hidden="true"
          >
            {connections.map((path, i) => (
              <path key={path} d={path} data-selected={selected === i} />
            ))}
          </svg>
          <WorldPresence moving={moving} />
          <nav className="gw-world-nodes" aria-label="Choose a destination">
            {worlds.map((item, index) => (
              <button
                type="button"
                key={item.id}
                className="gw-world-node"
                data-position={index}
                onClick={() => select(index)}
                aria-pressed={index === selected}
                aria-controls="world-destination"
                aria-label={item.name}
              >
                <span className="gw-node-glyph" aria-hidden="true">
                  <svg viewBox="0 0 32 32" fill="none">
                    <path
                      d={
                        [
                          'M5 17h5l3-8 5 15 3-8h6',
                          'M16 4 25 16 16 28 7 16Z M11 16h10',
                          'M16 5v5m0 12v5M5 16h5m12 0h5 M16 11l4 5-4 5-4-5Z',
                          'M7 10 16 5l9 5v12l-9 5-9-5Z M7 10l9 6 9-6M16 16v11',
                        ][index]
                      }
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className="gw-node-name">{item.name}</span>
                <span className="gw-node-context">{item.theme}</span>
              </button>
            ))}
          </nav>
          <span className="gw-atlas-caption">THE PARTS BELONG TO ONE LIFE</span>
        </div>
        <div className="gw-world-choice" id="world-destination">
          {priority.data?.mode === 'personal' ? (
            <WorldPrioritySummary priority={priority} onOpen={() => setDirection(true)} />
          ) : (
            <div className="gw-choice-copy" key={world.id}>
              <p className="gw-kicker">
                {world.number} / {world.theme}
              </p>
              <h2>{world.name}</h2>
              <p>{world.line}</p>
            </div>
          )}
          <Link className="gw-world-enter" href={world.href} prefetch={false}>
            Enter {world.name}
            <span aria-hidden="true">↗</span>
          </Link>
          <div className="gw-world-utilities">
            {priority.data?.mode === 'guest' && (
              <button
                onClick={() => {
                  track('claim_clicked');
                  requestAccountClaim();
                }}
              >
                Create free account ↗
              </button>
            )}
            <button type="button" onClick={() => setDirection(true)} aria-haspopup="dialog">
              Find my next move <span aria-hidden="true">↗</span>
            </button>
            <button type="button" onClick={() => setDirectory(true)} aria-haspopup="dialog">
              All destinations <span aria-hidden="true">+</span>
            </button>
          </div>
          <Link className="gw-world-replay" href="/experience?replay=1" prefetch={false}>
            <span aria-hidden="true">↺</span> Replay experience
          </Link>
          <span className="sr-only" role="status">
            {world.name} selected. {world.line}
          </span>
        </div>
      </section>
      <ContextSheet
        open={direction}
        title="Your next move"
        busy={priority.saving}
        onClose={closeDirection}
      >
        <WorldPriorityEditor priority={priority} />
      </ContextSheet>
      <ContextSheet open={directory} title="Your destinations" onClose={() => setDirectory(false)}>
        <nav className="gw-directory" aria-label="All destinations">
          {worlds.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              onClick={() => setDirectory(false)}
              prefetch={false}
            >
              <strong>{item.name}</strong>
              <span>{item.detail}</span>
            </Link>
          ))}
          <Link href="/app/progress">
            <strong>Progress</strong>
            <span>Your recorded actions and reflections.</span>
          </Link>
          <Link href="/shop">
            <strong>Legacy Reserve</strong>
            <span>The collection.</span>
          </Link>
          <Link href="/reserve">
            <strong>The Reserve</strong>
            <span>Personal care in Eunice.</span>
          </Link>
        </nav>
        <p className="gw-muted">Brotherhood and Legacy environments are future destinations.</p>
      </ContextSheet>
    </>
  );
}
