'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useWorldStill } from '@/components/public/cinematic-world';

/** Animate the photographic scene, never fabricate or retouch merchandise. */
export function ProductPhotoFrame({ children }: { children: ReactNode }) {
  const frame = useRef<HTMLSpanElement>(null);
  const still = useWorldStill();
  useEffect(() => {
    const node = frame.current;
    if (!node || still) return;
    let visible = false;
    const sync = () => {
      node.dataset.photoActive = String(visible && !document.hidden);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = Boolean(entry?.isIntersecting);
        sync();
      },
      { threshold: 0.15 },
    );
    observer.observe(node);
    document.addEventListener('visibilitychange', sync);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
      delete node.dataset.photoActive;
    };
  }, [still]);
  return (
    <span ref={frame} className="reserve-photo-frame">
      <span className="reserve-photo-aura" aria-hidden="true" />
      <span className="reserve-photo-window">{children}</span>
      <span className="reserve-photo-corners" aria-hidden="true" />
    </span>
  );
}
