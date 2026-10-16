'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  measuredAudioLevel,
  type IntelligenceOperation,
} from '@/platform/visual/intelligence-motion';
import {
  conversationMotionMode,
  type ConversationArtifactHint,
} from '@/platform/visual/conversation-motion';
import { motionPresentationPhase } from '@/platform/visual/motion-presentation';
import Image from 'next/image';
import { brand } from '@/platform/brand';
import './living-signal.css';

export type LivingSignalSurface =
  | 'conversation'
  | 'welcome'
  | 'voice-compact'
  | 'task'
  | 'toolbar';

/** Compact official mark plus a real-work filament. Never invents activity. */
export function LivingSignal({
  operation,
  still,
  surface = 'conversation',
  artifacts = [],
}: {
  operation: IntelligenceOperation;
  still: boolean;
  surface?: LivingSignalSurface;
  artifacts?: ConversationArtifactHint[];
}) {
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
  const mode = conversationMotionMode(operation, artifacts);
  const measured = still ? 0 : measuredAudioLevel(operation);
  return (
    <span
      ref={ref}
      className={`im-presence identity-presence im-living im-living-${surface}`}
      data-phase={phase}
      data-mode={mode}
      data-surface={surface}
      data-still={still}
      data-paused={!visible || hidden}
      data-animate={visible && !hidden && !still}
      data-motion={still ? 'still' : 'ambient'}
      data-operation={operation.id}
      data-persistence={operation.persistence ?? 'not-applicable'}
      style={
        {
          ...(measured > 0 ? { '--level': measured, '--im-level': measured } : {}),
        } as CSSProperties
      }
      aria-hidden="true"
    >
      <span className="im-emblem">
        <Image
          src={brand.conversationEmblem}
          alt=""
          width={24}
          height={24}
          unoptimized
          draggable={false}
        />
      </span>
      <span className="im-signal-track">
        <span className="im-signal-recess" />
        <span className="im-signal-highlight" />
        <span className="im-filament" />
        <span className="im-signal-gold" />
      </span>
    </span>
  );
}
