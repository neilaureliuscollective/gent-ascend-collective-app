'use client';
import { useEffect, useId, useRef } from 'react';
import palette from '@/platform/visual/aether-palette.json';

/** Decorative presence only: no simulated listening or request state. */
export function EnergyOrb({
  moving,
  className = '',
  framing = 2.25,
}: {
  moving: boolean;
  className?: string;
  framing?: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const id = useId().replaceAll(':', '');
  useEffect(() => {
    if (!moving || !host.current) return;
    const element = host.current;
    let disposed = false;
    let destroy: (() => void) | undefined;
    void import('@/platform/visual/world-energy-renderer')
      .then(({ mountWorldEnergy }) => {
        if (!disposed) destroy = mountWorldEnergy(element, framing);
      })
      .catch(() => {});
    return () => {
      disposed = true;
      destroy?.();
    };
  }, [moving, framing]);
  return (
    <div className={`gw-energy-orb ${className}`} ref={host} aria-hidden="true">
      <svg viewBox="0 0 240 240" fill="none" className="gw-energy-fallback">
        <defs>
          <radialGradient id={`${id}-body`} cx=".35" cy=".3" r=".75">
            <stop stopColor={palette.petrol} />
            <stop offset=".5" stopColor={palette.deep} />
            <stop offset="1" stopColor={palette.obsidian} />
          </radialGradient>
          <radialGradient id={`${id}-halo`}>
            <stop stopColor={palette.luminous} stopOpacity=".3" />
            <stop offset="1" stopColor={palette.luminous} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}-flow`} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor={palette.silver} />
            <stop offset=".65" stopColor={palette.petrol} />
            <stop offset="1" stopColor={palette.luminous} />
          </linearGradient>
          <clipPath id={`${id}-clip`}>
            <circle cx="120" cy="120" r="77" />
          </clipPath>
        </defs>
        <circle cx="120" cy="120" r="118" fill={`url(#${id}-halo)`} />
        <ellipse
          cx="120"
          cy="120"
          rx="110"
          ry="32"
          transform="rotate(-29 120 120)"
          stroke={palette.luminous}
          strokeOpacity=".12"
          strokeWidth=".65"
        />
        <circle
          cx="120"
          cy="120"
          r="77"
          fill={`url(#${id}-body)`}
          stroke={palette.luminous}
          strokeOpacity=".45"
        />
        <g clipPath={`url(#${id}-clip)`} stroke={`url(#${id}-flow)`}>
          {Array.from({ length: 18 }, (_, i) => (
            <path
              key={i}
              d={`M35 ${51 + i * 8} C75 ${26 + i * 8} 84 ${79 + i * 8} 121 ${49 + i * 8} S166 ${63 + i * 8} 209 ${29 + i * 8}`}
              strokeWidth={i % 3 === 0 ? 1.8 : 0.8}
              opacity={0.12 + (i % 3) * 0.06}
            />
          ))}
        </g>
        <path
          d="M24 164Q58 195 159 142Q231 103 214 79"
          stroke={palette.luminous}
          strokeOpacity=".12"
          strokeWidth=".6"
        />
        <circle cx="211" cy="94" r="2" fill={palette.silver} />
      </svg>
    </div>
  );
}
