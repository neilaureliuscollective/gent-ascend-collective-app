'use client';
import { useEffect, useState } from 'react';
import { useAppearance } from '@/components/visual/appearance';

/** Presentation only. Never hides or remounts the saved Command workspace. */
export function CommandArrival() {
  const { moving } = useAppearance();
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!moving || matchMedia('(display-mode: standalone)').matches) return;
    try {
      if (sessionStorage.getItem('gent-command-arrival-v2')) return;
      sessionStorage.setItem('gent-command-arrival-v2', 'seen');
    } catch {
      return;
    }
    const start = window.setTimeout(() => setActive(true), 0);
    const end = window.setTimeout(() => setActive(false), 1800);
    return () => {
      clearTimeout(start);
      clearTimeout(end);
    };
  }, [moving]);
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => setActive(false), 1800);
    return () => clearTimeout(timer);
  }, [active]);
  return (
    <>
      <button
        className="command-replay text-button"
        onClick={() => setActive(true)}
        disabled={active || !moving}
      >
        Replay arrival
      </button>
      {active && moving && (
        <div className="command-opening" aria-hidden="true">
          <span>
            GENT ASCEND <small>COLLECTIVE</small>
          </span>
          <p>Your world. In focus.</p>
        </div>
      )}
    </>
  );
}
