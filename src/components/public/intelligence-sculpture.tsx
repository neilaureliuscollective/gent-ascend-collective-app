'use client';
import { useEffect, useRef } from 'react';
import { useWorldStill } from './cinematic-world';

/** Optional near-viewport WebGL enhancement; the CSS sculpture remains the fallback. */
export function IntelligenceSculpture() {
  const host = useRef<HTMLDivElement>(null);
  const still = useWorldStill();
  useEffect(() => {
    const node = host.current;
    if (!node || still) return;
    let disposed = false;
    let pending = false;
    let stage: { dispose: () => void } | undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || pending) return;
        pending = true;
        import('./intelligence-stage')
          .then(({ createIntelligenceStage }) => {
            if (disposed) return;
            try {
              stage = createIntelligenceStage(node);
            } catch {
              node.dataset.ready = 'false';
            }
          })
          .catch(() => {
            node.dataset.ready = 'false';
          });
      },
      { rootMargin: '150px' },
    );
    observer.observe(node);
    return () => {
      disposed = true;
      observer.disconnect();
      stage?.dispose();
      node.dataset.ready = 'false';
    };
  }, [still]);
  return <div className="estate-sculpture" ref={host} aria-hidden="true" />;
}
