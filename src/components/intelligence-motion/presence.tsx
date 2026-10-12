'use client';
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { useAppearance } from '@/components/visual/appearance';
import {
  intelligenceBusy,
  intelligenceStatus,
  measuredAudioLevel,
  type IntelligenceOperation,
} from '@/platform/visual/intelligence-motion';
import palette from '@/platform/visual/aether-palette.json';
import './motion.css';

/** Lightweight signature. No provider, timer, microphone, progress estimation or WebGL. */
export function IntelligencePresence({
  operation,
  size = 'compact',
  artwork,
  variant = 'orb',
}: {
  operation: IntelligenceOperation;
  size?: 'compact' | 'large';
  artwork?: ReactNode;
  variant?: 'orb' | 'signal';
}) {
  const { moving } = useAppearance();
  const host = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = host.current;
    if (!node || !moving || typeof IntersectionObserver === 'undefined') return;
    let visible = false;
    const sync = () => {
      node.dataset.animate = String(visible && !document.hidden);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      sync();
    });
    observer.observe(node);
    document.addEventListener('visibilitychange', sync);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
      node.dataset.animate = 'false';
    };
  }, [moving]);
  const style = {
    '--im-emerald': palette.emerald,
    '--im-light': palette['aether-glow'],
    '--im-gold': palette.gold,
    '--im-core': palette.obsidian,
    '--im-level': moving ? measuredAudioLevel(operation) : 0,
  } as CSSProperties;
  const phase =
    operation.phase === 'complete' && operation.persistence === 'pending'
      ? 'saving'
      : operation.phase;
  return (
    <span
      ref={host}
      className={`im-presence im-${size} im-${variant}`}
      data-phase={phase}
      data-motion={moving ? 'ambient' : 'still'}
      data-persistence={operation.persistence ?? 'not-applicable'}
      style={style}
      data-artwork={Boolean(artwork)}
      aria-hidden="true"
    >
      {artwork && <span className="im-artwork">{artwork}</span>}
      <span className="im-halo" />
      <span className="im-core">
        <span className="im-flow" />
        <span className="im-contour" />
      </span>
      <span className="im-orbit">
        <span />
      </span>
      <span className="im-resolution" />
      {variant === 'signal' && (
        <>
          <span className="im-ribbon im-ribbon-one" />
          <span className="im-ribbon im-ribbon-two" />
          <span className="im-ribbon im-ribbon-three" />
          <span className="im-lightline" />
        </>
      )}
    </span>
  );
}
export function IntelligenceStatus({ operation }: { operation: IntelligenceOperation }) {
  return (
    <span className="im-status" role="status" aria-atomic="true">
      {operation.basis === 'preview' ? 'Preview · ' : ''}
      {intelligenceStatus(operation)}
    </span>
  );
}
export function IntelligenceActivity({ operation }: { operation: IntelligenceOperation }) {
  return (
    <div className="im-activity">
      <IntelligencePresence operation={operation} variant="signal" />
      <IntelligenceStatus operation={operation} />
    </div>
  );
}
/** Primary feedback lives with the response, never behind a drawer or toolbar. */
export function IntelligenceResponse({
  operation,
  name = 'Aethelios',
}: {
  operation: IntelligenceOperation;
  name?: string;
}) {
  return (
    <div className="im-response" data-phase={operation.phase} data-operation={operation.id}>
      <IntelligencePresence operation={operation} variant="signal" size="large" />
      <div className="im-response-copy">
        <span className="im-response-name">{name}</span>
        <IntelligenceStatus operation={operation} />
      </div>
    </div>
  );
}
export function IntelligenceTaskCard({
  operation,
  title,
  children,
}: {
  operation: IntelligenceOperation;
  title: string;
  children?: ReactNode;
}) {
  return (
    <section className="im-task" aria-label={title}>
      <h3>{title}</h3>
      <IntelligenceActivity operation={operation} />
      <div aria-busy={intelligenceBusy(operation)}>{children}</div>
    </section>
  );
}
