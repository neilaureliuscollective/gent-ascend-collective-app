'use client';
import Image from 'next/image';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useAppearance } from '@/components/visual/appearance';
import { AureliusPresence } from '@/components/visual/aurelius-presence';
import type { worlds } from '@/platform/world/registry';

type Connection = EventTarget & { saveData?: boolean };
function connection() {
  return (navigator as Navigator & { connection?: Connection }).connection;
}
function subscribeData(callback: () => void) {
  const network = connection();
  network?.addEventListener('change', callback);
  return () => network?.removeEventListener('change', callback);
}
function dataSaver() {
  return connection()?.saveData === true;
}

/** One observer governs decoration only. Navigation never waits for imagery or graphics. */
export function useWorldAtmosphere() {
  const ref = useRef<HTMLElement>(null);
  const { moving, solid } = useAppearance();
  const saveData = useSyncExternalStore(subscribeData, dataSaver, () => true);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let visible = true;
    const sync = () => {
      element.dataset.animated = String(
        moving &&
          !saveData &&
          visible &&
          !document.hidden &&
          !document.querySelector('dialog[open]'),
      );
    };
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      sync();
    });
    const dialogs = new MutationObserver(sync);
    intersection.observe(element);
    dialogs.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => {
      intersection.disconnect();
      dialogs.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, [moving, saveData]);
  return { ref, moving: moving && !saveData, solid, saveData };
}

export function WorldScenery({
  world,
  saveData,
}: {
  world: (typeof worlds)[number];
  saveData: boolean;
}) {
  return (
    <div className="gw-atmosphere" aria-hidden="true">
      <div className="gw-chamber">
        <Image src="/media/world/whole-man-chamber-v2.webp" alt="" fill sizes="100vw" preload />
      </div>
      {world.id !== 'performance' && !saveData ? (
        <DestinationScenery key={world.id} image={world.image} />
      ) : null}
      <div className="gw-atmosphere-shade" />
      <div className="gw-light-shaft" />
      <div className="gw-horizon" />
    </div>
  );
}
function DestinationScenery({ image }: { image: string }) {
  const [ready, setReady] = useState(false);
  return (
    <div className="gw-scenery" data-ready={ready}>
      <Image src={image} alt="" fill sizes="100vw" onLoad={() => setReady(true)} />
    </div>
  );
}
export function WorldPresence({ moving }: { moving: boolean }) {
  return (
    <div className="gw-atlas-presence">
      <div className="gw-orb-halo" aria-hidden="true" />
      <AureliusPresence enhanced motionEnabled={moving} />
      <span>AETHELIOS</span>
      <p>Your intelligence</p>
    </div>
  );
}
