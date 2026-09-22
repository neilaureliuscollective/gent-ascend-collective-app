'use client';
import { useId, useState } from 'react';
import { AureliusPresence } from './aurelius-presence';
import { useAppearance } from './appearance';
import type { OrbState, PresenceState } from '@/platform/visual/presence-state';
const previews = [
  ['ready', 'Idle'],
  ['preview-listening', 'Listening'],
  ['working', 'Thinking'],
  ['preview-speaking', 'Speaking'],
  ['preview-insight', 'Insight'],
  ['preview-milestone', 'Milestone'],
  ['stopped', 'Stopped'],
] as const;
export function OrbPresentation({ state }: { state: PresenceState }) {
  const [open, setOpen] = useState(false);
  const [previewState, setPreviewState] = useState<OrbState>('ready');
  const { moving } = useAppearance();
  const id = useId();
  // A real request or interruption takes precedence over the visual preview.
  const previewing = open && (state === 'ready' || state === 'disconnected');
  return (
    <div className={`orb-presentation ${previewing ? 'is-previewing' : ''}`}>
      <AureliusPresence enhanced state={previewing ? previewState : state} preview={previewing} />
      <button
        className="orb-preview-toggle"
        aria-expanded={previewing}
        aria-controls={id}
        onClick={() => {
          setOpen(!open);
          setPreviewState('ready');
        }}
        disabled={state !== 'ready' && state !== 'disconnected'}
      >
        {previewing ? 'Close Orb preview' : 'Explore the Orb'}
      </button>
      {previewing && (
        <div className="orb-preview-controls" id={id}>
          <p className="orb-preview-caption">Motion preview · microphone off · no audio</p>
          <div role="group" aria-label="Orb motion preview">
            {previews.map(([value, label]) => (
              <button
                key={value}
                aria-pressed={previewState === value}
                onClick={() => setPreviewState(value)}
              >
                {label}
              </button>
            ))}
          </div>
          {!moving && (
            <p className="orb-preview-description" aria-live="polite">
              Still mode · state changes remain visible.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
