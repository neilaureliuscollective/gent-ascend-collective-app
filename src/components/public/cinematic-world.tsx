'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

const StillContext = createContext(false);
export const useWorldStill = () => useContext(StillContext);

/** One native-scroll director. No scroll capture, hidden copy, or per-frame React updates. */
export function CinematicWorld({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const pathname = usePathname();
  const still = paused || reduced;
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const scenes = [
      ...node.querySelectorAll<HTMLElement>('#world-main > section, #world-main > header'),
    ];
    let frame = 0;
    const visible = new Set<HTMLElement>();
    const paint = () => {
      frame = 0;
      if (document.hidden) return;
      const measurements = [...visible].map((scene) => ({
        scene,
        rect: scene.getBoundingClientRect(),
      }));
      for (const { scene, rect } of measurements) {
        const progress = still
          ? 0.5
          : Math.max(0, Math.min(1, (innerHeight - rect.top) / (innerHeight + rect.height)));
        scene.style.setProperty('--scene-progress', progress.toFixed(4));
        scene.style.setProperty('--scene-shift', `${(progress - 0.5) * 90}px`);
        scene.style.setProperty('--scene-turn', `${(progress - 0.5) * 35}deg`);
      }
      const range = document.documentElement.scrollHeight - innerHeight;
      node.style.setProperty('--journey', String(range > 0 ? scrollY / range : 0));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const scene = e.target as HTMLElement;
          scene.dataset.inView = String(e.isIntersecting);
          if (e.isIntersecting) visible.add(scene);
          else visible.delete(scene);
        }
        schedule();
      },
      { rootMargin: '100px' },
    );
    scenes.forEach((scene) => {
      scene.classList.add('cinematic-scene');
      observer.observe(scene);
    });
    addEventListener('scroll', schedule, { passive: true });
    addEventListener('resize', schedule);
    document.addEventListener('visibilitychange', schedule);
    schedule();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      removeEventListener('scroll', schedule);
      removeEventListener('resize', schedule);
      document.removeEventListener('visibilitychange', schedule);
      scenes.forEach((scene) => {
        scene.style.removeProperty('--scene-shift');
        scene.style.removeProperty('--scene-turn');
      });
    };
  }, [pathname, still]);
  return (
    <StillContext value={still}>
      <div ref={root} className="public-world" data-world-still={still}>
        <div className="journey-progress" aria-hidden="true" />
        {children}
        <button
          className="world-motion-control"
          aria-pressed={still}
          onClick={() => setPaused(!paused)}
          disabled={reduced}
        >
          <span aria-hidden="true">{still ? '◇' : '◈'}</span>{' '}
          {reduced ? 'Reduced motion' : paused ? 'Enable motion' : 'Still mode'}
        </button>
      </div>
    </StillContext>
  );
}
