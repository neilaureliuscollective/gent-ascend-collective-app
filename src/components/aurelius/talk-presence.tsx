'use client';
import { TalkDrawer } from './talk-controls';
import { IntelligenceOrb } from '../public/intelligence-orb';
import { useAppearance } from '../visual/appearance';
import type { PresenceState } from '@/platform/visual/presence-state';

/** Actual request state only. Opening the orb never starts audio or a model request. */
export function TalkPresence({ state }: { state: PresenceState }) {
  const { moving } = useAppearance();
  return (
    <span className="talk-presence" data-state={state}>
      <TalkDrawer
        label="Aethelios presence"
        triggerContent={
          <span className="talk-orb">
            <IntelligenceOrb active={moving} engaged={state === 'working'} deepGreen />
          </span>
        }
      >
        <div className="talk-presence-room">
          <span className="talk-orb">
            <IntelligenceOrb active={moving} engaged={state === 'working'} deepGreen />
          </span>
          <h3>Aethelios</h3>
          <p>
            {state === 'working'
              ? 'Working on your request'
              : state === 'stopped'
                ? 'Conversation interrupted'
                : state === 'ready'
                  ? 'Ready when you are'
                  : 'Connect to begin'}
          </p>
          <p className="quiet-label">Your conversation stays in place. Microphone off.</p>
        </div>
      </TalkDrawer>
    </span>
  );
}
