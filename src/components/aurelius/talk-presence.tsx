'use client';
import { TalkDrawer } from './talk-controls';
import { IntelligenceStatus } from '../intelligence-motion/presence';
import { LivingSignal } from '../intelligence-motion/living-signal';
import { useAppearance } from '../visual/appearance';
import type { IntelligenceOperation } from '@/platform/visual/intelligence-motion';
import { observedOperation } from '@/platform/visual/operation-adapters';
import type { PresenceState } from '@/platform/visual/presence-state';

/** Presentation adapter only. Existing drawer, identity and microphone behavior remain. */
export function TalkPresence({
  state,
  operation,
  microphone = 'off',
}: {
  state: PresenceState;
  operation?: IntelligenceOperation;
  microphone?: 'off' | 'active' | 'muted';
}) {
  const { moving } = useAppearance();
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
          <span className="talk-orb talk-orb-mark">
            <LivingSignal operation={snapshot} still={!moving} surface="toolbar" />
          </span>
        }
      >
        <div className="talk-presence-room">
          <LivingSignal operation={snapshot} still={!moving} surface="conversation" />
          <h3>Aethelios</h3>
          {snapshot.phase === 'ready' ? (
            <p>{state === 'disconnected' ? 'Connect to begin' : 'Ready when you are'}</p>
          ) : (
            <IntelligenceStatus operation={snapshot} announce={false} />
          )}
          <p className="quiet-label">
            {microphone === 'active'
              ? 'Your conversation stays in place. Voice is active in the dock.'
              : microphone === 'muted'
                ? 'Your conversation stays in place. Microphone muted; the session stays connected.'
                : 'Your conversation stays in place. Microphone off.'}
          </p>
        </div>
      </TalkDrawer>
    </span>
  );
}
