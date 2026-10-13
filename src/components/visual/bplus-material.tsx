'use client';
import { useId, type ReactNode } from 'react';
import './bplus-material.css';

/** Static decoration only: no measured layout, events, animation loop or operation state. */
export function BplusMaterial({ radius }: { radius: 8 | 10 | 19 }) {
  const id = useId().replaceAll(':', '');
  const paint = (name: string) => `url(#${id}-${name})`;
  const stop = (offset: number, token: string, opacity = 1) => (
    <stop
      key={offset}
      offset={offset}
      stopColor={`var(--aether-optical-${token})`}
      stopOpacity={opacity}
    />
  );
  return (
    <svg
      className="bplus-optics"
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={`${id}-edge`} x1="0" y1="0" x2=".85" y2="1">
          {[
            [0, 'edge-0'],
            [0.035, 'edge-035'],
            [0.16, 'edge-16'],
            [0.42, 'edge-42'],
            [0.7, 'edge-70'],
            [0.91, 'edge-91'],
            [1, 'edge-100'],
          ].map(([n, c]) => stop(Number(n), String(c)))}
        </linearGradient>
        <linearGradient id={`${id}-face`} x1="0" y1="0" x2=".97" y2=".68">
          {[
            [0, 'face-0'],
            [0.17, 'face-17'],
            [0.55, 'face-55'],
            [0.83, 'face-83'],
            [1, 'face-100'],
          ].map(([n, c]) => stop(Number(n), String(c)))}
        </linearGradient>
        <linearGradient id={`${id}-light`} x1="0" y1="0" x2="1" y2=".76">
          {stop(0, 'light', 0.055)}
          {stop(0.22, 'light', 0.018)}
          {stop(0.35, 'light', 0)}
          {stop(1, 'light', 0)}
        </linearGradient>
        <linearGradient
          id={`${id}-slab`}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2="31%"
          y2="0"
        >
          {stop(0, 'slab-0', 0.9)}
          {stop(0.25, 'slab-25', 0.8)}
          {stop(1, 'slab-100', 0)}
        </linearGradient>
        <linearGradient
          id={`${id}-catch`}
          gradientUnits="userSpaceOnUse"
          x1={radius}
          y1="0"
          x2="28%"
          y2="0"
        >
          {stop(0, 'catch-0', 0.58)}
          {stop(0.12, 'catch-12', 0.78)}
          {stop(0.4, 'catch-40', 0.38)}
          {stop(1, 'catch-100', 0)}
        </linearGradient>
        <linearGradient
          id={`${id}-left`}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1={radius}
          x2="0"
          y2="72%"
        >
          {stop(0, 'left', 0.48)}
          {stop(1, 'left', 0)}
        </linearGradient>
        <linearGradient
          id={`${id}-return`}
          gradientUnits="userSpaceOnUse"
          x1="72%"
          y1="0"
          x2="100%"
          y2="0"
        >
          {stop(0, 'return-0', 0)}
          {stop(0.75, 'return-75', 0.64)}
          {stop(1, 'return-100', 0.55)}
        </linearGradient>
      </defs>
      <rect
        className="bplus-body"
        x=".375"
        y=".375"
        rx={radius}
        fill={paint('edge')}
        stroke="var(--aether-optical-outer-stroke)"
        strokeWidth=".75"
      />
      <rect
        className="bplus-substrate"
        x="1.7"
        y="2.2"
        rx={radius - 1.7}
        fill="var(--aether-optical-substrate)"
        stroke="var(--aether-optical-inner-stroke)"
        strokeWidth=".8"
      />
      <rect
        className="bplus-face"
        x="4.7"
        y="4.4"
        rx={radius - 4.7}
        fill={paint('face')}
        stroke="var(--aether-optical-face-stroke)"
        strokeWidth=".65"
      />
      <rect className="bplus-light" x="5.4" y="5.1" rx={radius - 5.4} fill={paint('light')} />
      <g id={`${id}-glints`} fill="none" strokeLinecap="round">
        <path
          d={`M2.4 ${radius} Q2.4 2.4 ${radius} 2.4`}
          stroke={paint('slab')}
          strokeWidth="2.4"
        />
        <line x1={radius} y1="2.4" x2="31%" y2="2.4" stroke={paint('slab')} strokeWidth="2.4" />
        <line x1={radius} y1="1.25" x2="28%" y2="1.25" stroke={paint('catch')} strokeWidth="1.1" />
        <line x1="1.1" y1={radius + 2} x2="1.1" y2="61%" stroke={paint('left')} strokeWidth=".85" />
        <path
          d="M8 9 Q8 5.2 16 5.2"
          stroke="var(--aether-optical-inner-catch)"
          strokeOpacity=".12"
          strokeWidth=".65"
        />
        <line
          x1="16"
          y1="5.2"
          x2="18%"
          y2="5.2"
          stroke="var(--aether-optical-inner-catch)"
          strokeOpacity=".12"
          strokeWidth=".65"
        />
      </g>
      <use href={`#${id}-glints`} className="bplus-emphasis" />
      <svg x="13" width="100%" height="100%" className="bplus-undercut" overflow="visible">
        <line
          x1="0"
          x2="100%"
          y1="100%"
          y2="100%"
          transform="translate(0 -5.8)"
          stroke="var(--aether-optical-undercut)"
          strokeOpacity=".95"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
      <svg
        width="100%"
        height="100%"
        style={{ width: `calc(100% - ${radius}px)` }}
        overflow="visible"
      >
        <line
          x1="72%"
          x2="100%"
          y1="100%"
          y2="100%"
          transform="translate(0 -2.1)"
          stroke={paint('return')}
          strokeWidth="1.25"
          strokeLinecap="round"
        />
      </svg>
      <svg x="100%" y="100%" overflow="visible">
        <path
          d={`M${-radius} -2.1 Q-2.1 -2.1 -2.1 ${-radius}`}
          fill="none"
          stroke="var(--aether-optical-return-100)"
          strokeOpacity=".55"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
      </svg>
    </svg>
  );
}

/** Groups the existing New and Tools actions only in full Talk. Dialogs remain native. */
export function BplusTalkTools({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return enabled ? (
    <div
      className="bplus-tools"
      data-bplus-surface="tools"
      role="group"
      aria-label="Conversation tools"
    >
      <BplusMaterial radius={8} />
      {children}
    </div>
  ) : (
    <>{children}</>
  );
}
