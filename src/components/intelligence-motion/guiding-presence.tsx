'use client';
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import {
  measuredAudioLevel,
  type IntelligenceOperation,
} from '@/platform/visual/intelligence-motion';
import { motionPresentationPhase } from '@/platform/visual/motion-presentation';
import './guiding-presence.css';
/** Presentation only: never observes or initiates a domain operation. */
export function GuidingPresence({
  operation,
  still,
  compact = false,
}: {
  operation: IntelligenceOperation;
  still: boolean;
  compact?: boolean;
}) {
  const uid = useId().replaceAll(':', '');
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(true);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) =>
      setVisible(entries[0]?.isIntersecting ?? false),
    );
    if (ref.current) observer.observe(ref.current);
    const update = () => setHidden(document.hidden);
    update();
    document.addEventListener('visibilitychange', update);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  const phase = motionPresentationPhase(operation);
  const level = still ? 0 : measuredAudioLevel(operation);
  return (
    <span
      ref={ref}
      data-paused={!visible || hidden}
      data-animate={visible && !hidden && !still}
      data-motion={still ? 'still' : 'ambient'}
      className={`im-presence identity-presence identity-aperture ${compact ? 'identity-compact' : ''}`}
      data-phase={phase}
      data-still={still}
      data-operation={operation.id}
      style={{ '--level': level, '--im-level': level } as CSSProperties}
      aria-hidden="true"
    >
      <svg viewBox="0 0 240 240" focusable="false">
        <defs>
          <radialGradient id={`${uid}-body`} cx="32%" cy="25%" r="76%">
            <stop stopColor="#36896C" />
            <stop offset=".3" stopColor="#236A52" />
            <stop offset=".7" stopColor="#102B26" />
            <stop offset="1" stopColor="#080D0D" />
          </radialGradient>
          <radialGradient id={`${uid}-light`}>
            <stop stopColor="#7BE7B1" stopOpacity=".85" />
            <stop offset=".35" stopColor="#36896C" stopOpacity=".45" />
            <stop offset="1" stopColor="#174438" stopOpacity="0" />
          </radialGradient>
          <clipPath id={`${uid}-clip`}>
            <circle cx="120" cy="120" r="82" />
          </clipPath>
        </defs>
        <circle
          className="identity-boundary"
          cx="120"
          cy="120"
          r="92"
          fill="none"
          stroke="#C4912F"
          strokeWidth=".6"
        />
        <circle
          className="identity-body"
          cx="120"
          cy="120"
          r="82"
          fill={`url(#${uid}-body)`}
          stroke="#36896C"
          strokeWidth=".7"
        />
        <g clipPath={`url(#${uid}-clip)`}>
          <circle className="identity-light" cx="108" cy="104" r="76" fill={`url(#${uid}-light)`} />
          <g className="identity-flow" fill="none" stroke="#7BE7B1" strokeWidth=".8">
            <ellipse cx="120" cy="120" rx="63" ry="40" transform="rotate(-32 120 120)" />
            <ellipse cx="120" cy="120" rx="49" ry="29" transform="rotate(-32 120 120)" />
            <path d="M80 153 Q120 115 161 86" />
          </g>
          <g className="identity-focus">
            <path
              d="M120 102Q123 117 138 120Q123 123 120 138Q117 123 102 120Q117 117 120 102Z"
              fill="#E0BB6A"
            />
            <circle cx="120" cy="120" r="2" fill="#E6E7E2" />
          </g>
        </g>
        <path
          className="identity-aperture"
          d="M60 69 A79 79 0 0 1 180 69 M60 171 A79 79 0 0 0 180 171"
          fill="none"
          stroke="#E0BB6A"
          strokeWidth="1.1"
        />
        <circle
          className="identity-envelope"
          cx="120"
          cy="120"
          r="87"
          fill="none"
          stroke="#7BE7B1"
          strokeWidth="1"
        />
      </svg>
    </span>
  );
}
