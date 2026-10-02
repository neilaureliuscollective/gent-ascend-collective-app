'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useState, ViewTransition, startTransition } from 'react';
import { worlds } from '@/platform/world/registry';
import { AureliusPresence } from '@/components/visual/aurelius-presence';
import { ContextSheet } from '@/components/interaction/context-sheet';
import { GuestDirection } from './guest-direction';
export function WholeManWorld() {
  const [selected, setSelected] = useState(0);
  const [directory, setDirectory] = useState(false);
  const world = worlds[selected] ?? worlds[0];
  return (
    <>
      <section className="gw-observatory" aria-labelledby="world-heading">
        <div className="gw-environment" aria-hidden="true">
          <Image src="/media/world/observatory.webp" alt="" fill sizes="100vw" preload />
        </div>
        <div className="gw-world-intro">
          <p className="gw-kicker">YOUR WORLD / GENT ASCEND</p>
          <h1 id="world-heading" tabIndex={-1}>
            The parts belong
            <br />
            to <em>one life.</em>
          </h1>
          <p>Choose where you want to begin.</p>
        </div>
        <div className="gw-presence">
          <AureliusPresence enhanced />
          <span>AETHELIOS</span>
          <p>Perspective across your world.</p>
        </div>
        <div className="gw-destination">
          <nav className="gw-destination-tabs" aria-label="Choose a destination">
            {worlds.map((item, index) => (
              <button
                key={item.id}
                onClick={() => startTransition(() => setSelected(index))}
                aria-pressed={index === selected}
              >
                {item.name}
              </button>
            ))}
          </nav>
          <ViewTransition>
            <div className="gw-destination-detail" key={world.id}>
              <span className="gw-kicker">{world.number} / EXPLORE</span>
              <h2>{world.name}</h2>
              <p>{world.line}</p>
              <Link className="gw-action" href={world.href}>
                Enter {world.name} <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </ViewTransition>
          <button className="gw-all" onClick={() => setDirectory(true)}>
            All destinations +
          </button>
        </div>
      </section>
      <GuestDirection />
      <ContextSheet open={directory} title="Your destinations" onClose={() => setDirectory(false)}>
        <nav className="gw-directory" aria-label="All destinations">
          {worlds.map((item) => (
            <Link key={item.id} href={item.href} onClick={() => setDirectory(false)}>
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
