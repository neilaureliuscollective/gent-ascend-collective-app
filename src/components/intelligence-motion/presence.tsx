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
}: {
  operation: IntelligenceOperation;
  size?: 'compact' | 'large';
  artwork?: ReactNode;
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
      className={`im-presence im-${size}`}
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
      <IntelligencePresence operation={operation} />
      <IntelligenceStatus operation={operation} />
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
