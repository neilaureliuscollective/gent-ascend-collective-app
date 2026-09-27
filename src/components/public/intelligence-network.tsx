'use client';

import { useEffect, useRef, useState } from 'react';

const signals = ['YOU', 'HEALTH', 'RITUALS', 'GOALS', 'WORK', 'FAMILY'];

/** Decorative relationship geometry. The labels describe possibilities, never live data. */
export function IntelligenceNetwork() {
  const host = useRef<HTMLDivElement>(null);
  // Keep the SVG strokes mounted before GSAP creates its scroll timeline.
  const [paths, setPaths] = useState<string[]>(() => signals.map(() => 'M 0 0 L 0 0'));

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    let mounted = true;
    const measure = () => {
      if (!mounted) return;
      const centerX = node.clientWidth / 2;
      const centerY = node.clientHeight / 2;
      setPaths(
        Array.from(node.querySelectorAll<HTMLElement>('[data-intelligence-signal]')).map((signal) => {
          const x = signal.offsetLeft + signal.offsetWidth / 2;
          const y = signal.offsetTop + signal.offsetHeight / 2;
          const bendX = centerX + (x - centerX) * 0.28;
          const bendY = centerY + (y - centerY) * 0.16;
          return `M ${x} ${y} Q ${bendX} ${bendY} ${centerX} ${centerY}`;
        }),
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    measure();
    void document.fonts.ready.then(measure);
    return () => { mounted = false; observer.disconnect(); };
  }, []);

  return (
    <div className="ascend-connections" ref={host}>
      <i className="intelligence-convergence" aria-hidden="true" />
      <svg className="intelligence-network" width="100%" height="100%" aria-hidden="true">
        <defs>
          <linearGradient id="intelligence-connection-light" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#d9b36c" />
            <stop offset=".58" stopColor="#78c49a" />
            <stop offset="1" stopColor="#d9b36c" />
          </linearGradient>
        </defs>
        {paths.map((d, index) => (
          <g key={signals[index]}>
            <path className="intelligence-link-bed" d={d} />
            <path className="intelligence-link" d={d} pathLength="100" />
            <path className="intelligence-current" d={d} pathLength="100" />
          </g>
        ))}
      </svg>
      {signals.map((label, index) => (
        <span key={label} data-intelligence-signal={index}>
          <b><small>{String(index + 1).padStart(2, '0')}</small>{label}</b>
        </span>
      ))}
    </div>
  );
}
