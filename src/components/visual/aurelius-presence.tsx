'use client';
import { useEffect, useId, useRef } from 'react';
import { useAppearance } from './appearance';
export type PresenceState = 'disconnected' | 'ready' | 'working' | 'saved' | 'stopped';
export function AureliusPresence({
  enhanced = false,
  state = 'disconnected',
  className = '',
}: {
  enhanced?: boolean;
  state?: PresenceState;
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
      aria-hidden="true"
      ref={host}
    >
      <svg className="presence-fallback" viewBox="0 0 240 240" fill="none">
        <defs>
          <radialGradient id={`${id}-sphere`} cx=".35" cy=".25" r=".8">
            <stop stopColor="#85568C" />
            <stop offset=".3" stopColor="#36113F" />
            <stop offset=".7" stopColor="#150319" />
            <stop offset="1" stopColor="#060508" />
          </radialGradient>
          <linearGradient
            id={`${id}-gold`}
            x1="30"
            y1="20"
            x2="205"
            y2="220"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#FFF0C1" />
            <stop offset=".3" stopColor="#E4C080" />
            <stop offset=".6" stopColor="#765024" />
            <stop offset=".82" stopColor="#F0D49A" />
            <stop offset="1" stopColor="#9A7034" />
          </linearGradient>
        </defs>
        <circle cx="120" cy="120" r="78" fill={`url(#${id}-sphere)`} stroke="#C69B5550" />
        <g stroke={`url(#${id}-gold)`} strokeWidth="1.8">
          <ellipse cx="120" cy="120" rx="100" ry="86" transform="rotate(-28 120 120)" />
          <ellipse cx="120" cy="120" rx="45" ry="97" transform="rotate(-28 120 120)" />
          <ellipse cx="120" cy="120" rx="98" ry="35" transform="rotate(24 120 120)" />
        </g>
        <path d="m120 91 5 24 24 5-24 5-5 24-5-24-24-5 24-5Z" fill={`url(#${id}-gold)`} />
        <circle cx="37" cy="77" r="6" fill={`url(#${id}-gold)`} />
        <circle cx="195" cy="157" r="4" fill="#EDD09B" />
      </svg>
    </div>
  );
}
