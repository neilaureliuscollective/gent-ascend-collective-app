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
import { GuidingPresence } from './guiding-presence';
import { LivingSignal } from './living-signal';
import {
  conversationActivityLabel,
  conversationStatusVisible,
  type ConversationArtifactHint,
} from '@/platform/visual/conversation-motion';

/** Lightweight signature. No provider, timer, microphone, progress estimation or WebGL. */
function LegacyPresence({
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
/** Preserve existing artwork surfaces; response/task signals use the authored identity. */
export function IntelligencePresence(props: {
  operation: IntelligenceOperation;
  size?: 'compact' | 'large' | 'conversation';
  artwork?: ReactNode;
  variant?: 'orb' | 'signal';
}) {
  const { moving } = useAppearance();
  if (props.size === 'conversation') {
    return (
      <LivingSignal
        operation={props.operation}
        still={!moving}
        surface="conversation"
      />
    );
  }
  return props.variant === 'signal' && !props.artwork ? (
    <GuidingPresence operation={props.operation} still={!moving} compact={props.size !== 'large'} />
  ) : (
    <LegacyPresence
      operation={props.operation}
      size={props.size === 'large' ? 'large' : 'compact'}
      artwork={props.artwork}
      variant={props.variant}
    />
  );
}
export function IntelligenceStatus({
  operation,
  announce = true,
}: {
  operation: IntelligenceOperation;
  announce?: boolean;
}) {
  return (
    <span
      className="im-status"
      role={announce ? 'status' : undefined}
      aria-live={announce ? undefined : 'off'}
      aria-atomic={announce ? true : undefined}
    >
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
  artifacts = [],
}: {
  operation: IntelligenceOperation;
  name?: string;
  artifacts?: ConversationArtifactHint[];
}) {
  const { moving } = useAppearance();
  const status = conversationActivityLabel(operation, artifacts);
  return (
    <div
      className="im-response"
      data-phase={operation.phase}
      data-mode={operation.phase}
      data-operation={operation.id}
    >
      <LivingSignal operation={operation} still={!moving} surface="conversation" />
      <div className="im-response-copy">
        <span className="im-response-name">{name}</span>
        {conversationStatusVisible(operation) && (
          <span className="im-status" aria-live="off">
            {operation.basis === 'preview' ? 'Preview · ' : ''}
            {status}
          </span>
        )}
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
