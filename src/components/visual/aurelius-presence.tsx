'use client';
import { useEffect, useId, useRef } from 'react';
import { useAppearance } from './appearance';
import type { OrbState } from '@/platform/visual/presence-state';
export function AureliusPresence({
  enhanced = false,
  state = 'disconnected',
  className = '',
  preview = false,
}: {
  enhanced?: boolean;
  state?: OrbState;
  preview?: boolean;
  className?: string;
}) {
  const id = useId().replaceAll(':', '');
  const host = useRef<HTMLDivElement>(null);
  const { moving } = useAppearance();
  useEffect(() => {
    const element = host.current;
    if (!enhanced || !moving || !element) return;
    let disposed = false;
    let destroy: (() => void) | undefined;
    // Optional scene never blocks the first useful paint or the static emblem.
    const timer = window.setTimeout(() => {
      void import('@/platform/visual/presence-renderer')
        .then(({ mountPresence }) => {
          if (!disposed) destroy = mountPresence(element);
        })
        .catch(() => {
          /* The SVG remains the complete visual fallback. */
        });
    }, 900);
    return () => {
      disposed = true;
      clearTimeout(timer);
      destroy?.();
    };
  }, [enhanced, moving]);
  return (
    <div
      className={`aurelius-presence ${className}`}
      data-state={state}
      data-preview={preview}
      aria-hidden="true"
      ref={host}
    >
      <span className="presence-aura" />
      <span className="presence-reflection" />
      <svg className="presence-fallback" viewBox="0 0 240 240" fill="none">
        <defs>
          <radialGradient id={`${id}-sphere`} cx=".33" cy=".25" r=".8">
            <stop stopColor="#765377" />
            <stop offset=".13" stopColor="#422448" />
            <stop offset=".4" stopColor="#260B30" />
            <stop offset=".76" stopColor="#150319" />
            <stop offset="1" stopColor="#060609" />
          </radialGradient>
          <radialGradient id={`${id}-well`}>
            <stop stopColor="#9A628F" stopOpacity=".45" />
            <stop offset=".5" stopColor="#602D69" stopOpacity=".22" />
            <stop offset="1" stopColor="#150319" stopOpacity="0" />
          </radialGradient>
          <linearGradient
            id={`${id}-gold`}
            x1="40"
            y1="20"
            x2="190"
            y2="218"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#815520" />
            <stop offset=".18" stopColor="#E2B86B" />
            <stop offset=".24" stopColor="#FFF0C3" />
            <stop offset=".33" stopColor="#AC7731" />
            <stop offset=".58" stopColor="#684015" />
            <stop offset=".76" stopColor="#DBAC60" />
            <stop offset=".82" stopColor="#FFE5A9" />
            <stop offset="1" stopColor="#94642A" />
          </linearGradient>
          <linearGradient
            id={`${id}-sheen`}
            x1="60"
            y1="50"
            x2="180"
            y2="155"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#F6DCAE" stopOpacity=".65" />
            <stop offset=".3" stopColor="#F6DCAE" stopOpacity="0" />
            <stop offset="1" stopColor="#AD799A" stopOpacity=".2" />
          </linearGradient>
          <clipPath id={`${id}-clip`}>
            <circle cx="120" cy="117" r="74" />
          </clipPath>
        </defs>
        {/* Back halves remain behind the core, including in the no-GPU rendition. */}
        <g stroke={`url(#${id}-gold)`}>
          <ellipse
            cx="120"
            cy="117"
            rx="96"
            ry="90"
            strokeWidth="3.2"
            transform="rotate(-20 120 117)"
          />
          <ellipse
            cx="120"
            cy="117"
            rx="43"
            ry="92"
            strokeWidth="1.8"
            transform="rotate(-32 120 117)"
          />
          <ellipse
            cx="120"
            cy="117"
            rx="99"
            ry="39"
            strokeWidth="1"
            transform="rotate(24 120 117)"
          />
        </g>
        <circle
          cx="120"
          cy="117"
          r="74"
          fill={`url(#${id}-sphere)`}
          stroke="#AA729C44"
          strokeWidth=".6"
        />
        <g clipPath={`url(#${id}-clip)`}>
          <ellipse
            className="presence-inner-light"
            cx="109"
            cy="111"
            rx="65"
            ry="67"
            fill={`url(#${id}-well)`}
          />
          <g stroke={`url(#${id}-sheen)`} strokeWidth=".65">
            <path d="M48 143C112 58 130 176 194 83M45 128C92 57 149 164 193 95M56 89C129 144 127 57 187 129" />
            <path d="M61 81C87 55 140 46 172 74" strokeWidth="2.6" />
          </g>
          <g fill="#D8B277" opacity=".45">
            <circle cx="96" cy="109" r=".8" />
            <circle cx="140" cy="90" r=".6" />
            <circle cx="136" cy="152" r=".7" />
            <circle cx="80" cy="130" r=".5" />
          </g>
        </g>
        <g stroke={`url(#${id}-gold)`}>
          <path d="M24 117A96 90 0 0 0 216 117" strokeWidth="3.2" transform="rotate(-20 120 117)" />
          <path d="M120 25A43 92 0 0 1 120 209" strokeWidth="1.8" transform="rotate(-32 120 117)" />
          <path d="M21 117A99 39 0 0 0 219 117" strokeWidth="1" transform="rotate(24 120 117)" />
        </g>
        <path d="m120 96 4 17 17 4-17 4-4 17-4-17-17-4 17-4Z" fill={`url(#${id}-gold)`} />
        <circle cx="30" cy="144" r="4.8" fill={`url(#${id}-gold)`} />
        <circle cx="171" cy="46" r="3.4" fill={`url(#${id}-gold)`} />
        <circle cx="203" cy="158" r="2.6" fill="#E6C386" />
      </svg>
      <span className="presence-listening-halo" />
    </div>
  );
}
