'use client';
import { TalkDrawer } from './talk-controls';
import { IntelligencePresence, IntelligenceStatus } from '../intelligence-motion/presence';
import type { IntelligenceOperation } from '@/platform/visual/intelligence-motion';
import { observedOperation } from '@/platform/visual/operation-adapters';
import type { PresenceState } from '@/platform/visual/presence-state';

/** Presentation adapter only. Existing drawer, identity and microphone behavior remain. */
export function TalkPresence({
  state,
  operation,
}: {
  state: PresenceState;
  operation?: IntelligenceOperation;
}) {
  const snapshot =
    operation ??
    observedOperation(
      'talk-presence',
      state === 'working'
        ? 'waiting'
        : state === 'saved'
          ? 'complete'
          : state === 'stopped'
            ? 'cancelled'
            : 'ready',
      state === 'saved' ? 'confirmed' : 'not-applicable',
    );
  return (
    <span className="talk-presence" data-state={state} data-phase={snapshot.phase}>
      <TalkDrawer
        label="Aethelios presence"
        triggerContent={
          <span className="talk-orb">
            <IntelligencePresence operation={snapshot} variant="signal" />
          </span>
        }
      >
        <div className="talk-presence-room">
          <span className="talk-orb">
            <IntelligencePresence operation={snapshot} size="large" variant="signal" />
          </span>
          <h3>Aethelios</h3>
          {snapshot.phase === 'ready' ? (
            <p>{state === 'disconnected' ? 'Connect to begin' : 'Ready when you are'}</p>
          ) : (
            <IntelligenceStatus operation={snapshot} />
          )}
          <p className="quiet-label">Your conversation stays in place. Microphone off.</p>
        </div>
      </TalkDrawer>
    </span>
  );
}
