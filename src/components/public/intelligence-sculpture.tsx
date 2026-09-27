'use client';
import { useEffect, useRef } from 'react';
import { IntelligenceOrb } from './intelligence-orb';
import { useWorldStill } from './cinematic-world';

/** Public Aethelios identity, adapted from the founder command orb. */
export function IntelligenceSculpture() {
  const still = useWorldStill();
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const chapter = host.current?.closest<HTMLElement>('.ascend-emergence');
    if (!chapter) return;
    let visible = false;
    const sync = () => {
      chapter.dataset.ambientActive = String(visible && !document.hidden);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      sync();
    });
    observer.observe(chapter);
    document.addEventListener('visibilitychange', sync);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
      delete chapter.dataset.ambientActive;
    };
  }, []);
  return (
    <div className="estate-sculpture" aria-hidden="true" ref={host}>
      <IntelligenceOrb active={!still} />
    </div>
  );
}
