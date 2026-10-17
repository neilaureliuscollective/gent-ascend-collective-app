'use client';
import type { ReactNode } from 'react';

export type LiveCallControlModel = {
  muted: boolean;
  canMute: boolean;
  canStopPlayback: boolean;
  canEnd: boolean;
  cleanupPending: boolean;
  mode: 'immersive' | 'compact';
  transcript: boolean;
  canClose: boolean;
  docked?: boolean;
};

function MicIcon({ off }: { off?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
      <path
        d="M12 3.5a3.2 3.2 0 0 0-3.2 3.2v5.1a3.2 3.2 0 1 0 6.4 0V6.7A3.2 3.2 0 0 0 12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M7 11.4a5 5 0 0 0 10 0M12 16.4v3.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {off ? (
        <path d="M5 5.2 19 19" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      ) : null}
    </svg>
  );
}

function EndIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
      <path
        d="M5 14.2c4.6-3.2 9.4-3.2 14 0"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <path
        d="M5 14.2 3.6 11.4M19 14.2l1.4-2.8"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <rect x="7" y="7" width="10" height="10" rx="1.6" fill="currentColor" />
    </svg>
  );
}

function ModeIcon({ compact }: { compact: boolean }) {
  return compact ? (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M8 14.5 12 10l4 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M8 10 12 14.5 16 10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function TranscriptIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path
        d="M7 7h10M7 12h10M7 17h6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path
        d="m7 7 10 10M17 7 7 17"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CallAction({
  name,
  caption,
  pressed,
  kind = 'secondary',
  density = 'call',
  onClick,
  children,
}: {
  name: string;
  caption: string;
  pressed?: boolean;
  kind?: 'mute' | 'end' | 'secondary';
  density?: 'call' | 'dock';
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`live-call-action live-call-action-${kind}${density === 'dock' ? ' live-dock-action' : ''}`}
      aria-label={name}
      aria-pressed={pressed}
      onClick={onClick}
    >
      <span className="live-call-action-glyph" aria-hidden="true">
        {children}
      </span>
      <span className="live-call-action-caption" aria-hidden="true">
        {caption}
      </span>
    </button>
  );
}

export function LiveCallControls({
  model,
  density = 'call',
  onMute,
  onInterrupt,
  onEnd,
  onMode,
  onTranscript,
  onClose,
  children,
}: {
  model: LiveCallControlModel;
  density?: 'call' | 'dock';
  onMute?: () => void;
  onInterrupt?: () => void;
  onEnd?: () => void;
  onMode?: () => void;
  onTranscript?: () => void;
  onClose?: () => void;
  children?: ReactNode;
}) {
  const mute = model.canMute ? (
    <CallAction
      name={model.muted ? 'Unmute microphone' : 'Mute microphone'}
      caption={model.muted ? 'Unmute' : 'Mute'}
      pressed={model.muted}
      kind="mute"
      density={density}
      onClick={onMute}
    >
      <MicIcon off={model.muted} />
    </CallAction>
  ) : null;
  const stop = model.canStopPlayback ? (
    <CallAction name="Stop playback" caption="Stop" density={density} onClick={onInterrupt}>
      <StopIcon />
    </CallAction>
  ) : null;
  const end = model.canEnd ? (
    <CallAction
      name={model.cleanupPending ? 'Retry end session' : 'End session'}
      caption={model.cleanupPending ? 'Retry' : 'End'}
      kind="end"
      density={density}
      onClick={onEnd}
    >
      <EndIcon />
    </CallAction>
  ) : null;
  const mode = (
    <CallAction
      name={model.mode === 'immersive' ? 'Minimize voice' : 'Expand voice'}
      caption={model.mode === 'immersive' ? 'Minimize' : 'Expand'}
      density={density}
      onClick={onMode}
    >
      <ModeIcon compact={model.mode === 'compact'} />
    </CallAction>
  );
  const transcript = (
    <CallAction
      name={
        model.mode === 'immersive' || !model.docked
          ? 'Open live transcript'
          : 'Open conversation transcript'
      }
      caption="Transcript"
      density={density}
      onClick={onTranscript}
    >
      <TranscriptIcon />
    </CallAction>
  );
  const close = model.canClose ? (
    <CallAction name="Close" caption="Close" density={density} onClick={onClose}>
      <CloseIcon />
    </CallAction>
  ) : null;
  if (density === 'dock') {
    return (
      <div className="live-dock-actions" role="group" aria-label="Call session">
        {mute}
        {stop}
        {end}
        {mode}
        {transcript}
        {close}
        {children}
      </div>
    );
  }
  return (
    <div className="live-controls live-controls-compact live-call-controls">
      <div className="live-control-session" role="group" aria-label="Call session">
        {mute}
        {stop}
        {end}
      </div>
      <div className="live-control-layout" role="group" aria-label="Call layout">
        {mode}
        {transcript}
        {close}
      </div>
    </div>
  );
}
