'use client';
import Image from 'next/image';
import { useEffect, useRef } from 'react';
import { useWorldStill } from './cinematic-world';

/** Independent ambient layer: never hides copy or intercepts gestures. */
export function SceneAtmosphere({
  image,
  variant = 'stone',
}: {
  image?: string;
  variant?: 'stone' | 'dawn' | 'celestial' | 'sanctuary';
}) {
  const root = useRef<HTMLDivElement>(null);
  const still = useWorldStill();
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    let visible = false;
    const sync = () => {
      node.dataset.running = String(visible && !document.hidden && !still);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      sync();
    });
    observer.observe(node);
    document.addEventListener('visibilitychange', sync);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, [still]);
  return (
    <div
      ref={root}
      className={`scene-atmosphere atmosphere-${variant}`}
      aria-hidden="true"
      data-running="false"
    >
      {image && (
        <Image
          src={image}
          alt=""
          fill
          sizes="(max-width: 600px) 1400px, 100vw"
          className="atmosphere-environment"
        />
      )}
      <div className="atmosphere-shade" />
      <div className="atmosphere-light" />
      <div className="atmosphere-mist" />
      <svg className="atmosphere-stars" viewBox="0 0 1000 800" preserveAspectRatio="xMidYMid slice">
        {Array.from({ length: 22 }, (_, i) => (
          <circle
            key={i}
            cx={(i * 193 + 61) % 1000}
            cy={(i * 137 + 43) % 800}
            r={i % 5 === 0 ? 1.7 : 0.7}
            fill="currentColor"
          />
        ))}
        {variant === 'celestial' && (
          <g fill="none" stroke="currentColor" strokeWidth="0.45" opacity=".6">
            <ellipse cx="760" cy="370" rx="240" ry="300" />
            <ellipse cx="760" cy="370" rx="200" ry="300" transform="rotate(40 760 370)" />
            <path d="M760 38V700M420 370H1000" />
          </g>
        )}
      </svg>
    </div>
  );
}
