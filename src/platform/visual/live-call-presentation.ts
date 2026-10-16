import {
  intelligenceStatus,
  measuredAudioLevel,
  type IntelligenceOperation,
} from './intelligence-motion';
import { liveMotionOperation } from './operation-adapters';

export type LiveCallVisualKind =
  | 'idle'
  | 'connecting'
  | 'recovering'
  | 'listening'
  | 'waiting'
  | 'speaking'
  | 'muted'
  | 'blocked'
  | 'ended'
  | 'error';

export type LiveEnergySource = 'webrtc-stats' | 'unavailable';

export type LiveCallLevels = {
  input: number;
  output: number;
  source?: LiveEnergySource;
};

export type LiveCallSession = {
  sessionId: string | null;
  phase: 'idle' | 'connecting' | 'listening' | 'speaking' | 'ended' | 'error';
  muted: boolean;
  playbackBlocked: boolean;
  recovering?: boolean;
  speechDetected?: boolean;
  responsePending?: boolean;
  error?: string;
};

export type LiveCallVisual = {
  kind: LiveCallVisualKind;
  label: string;
  energy: number;
  energySource: LiveEnergySource;
  /** True only when atmosphere uses a measured audio sample, never a timer. */
  reactive: boolean;
  inward: number;
  outward: number;
  rotate: boolean;
  operation: IntelligenceOperation;
};

export function liveCallKind(state: LiveCallSession): LiveCallVisualKind {
  if (state.recovering) return 'recovering';
  if (state.phase === 'idle') return 'idle';
  if (state.phase === 'connecting') return 'connecting';
  if (state.phase === 'error') return 'error';
  if (state.phase === 'ended') return state.error ? 'error' : 'ended';
  if (state.phase === 'speaking' && state.playbackBlocked) return 'blocked';
  if (state.phase === 'speaking') return 'speaking';
  if (state.phase === 'listening' && state.muted) return 'muted';
  if (state.phase === 'listening' && state.responsePending) return 'waiting';
  if (state.phase === 'listening') return 'listening';
  return 'idle';
}

function clamp01(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

/** Map controller truth plus optional measured levels. Timers never invent speech. */
export function liveCallVisual(
  state: LiveCallSession,
  levels?: LiveCallLevels,
  options?: { moving?: boolean },
): LiveCallVisual {
  const operation = liveMotionOperation(state, levels);
  const kind = liveCallKind(state);
  const moving = options?.moving !== false;
  const source = levels?.source ?? (levels ? 'webrtc-stats' : 'unavailable');
  const measured = measuredAudioLevel(operation);
  const hasMeasured =
    source !== 'unavailable' &&
    measured > 0 &&
    (kind === 'listening' || kind === 'speaking');
  const energy = hasMeasured ? measured : 0;
  const inward =
    kind === 'listening'
      ? hasMeasured
        ? 0.22 + energy * 0.7
        : 0.2
      : kind === 'muted'
        ? 0.08
        : 0;
  const outward =
    kind === 'speaking'
      ? hasMeasured
        ? 0.28 + energy * 0.72
        : 0.3
      : kind === 'connecting' || kind === 'recovering'
        ? 0.16
        : kind === 'waiting'
          ? 0.12
          : kind === 'blocked'
            ? 0.1
            : 0;
  return {
    kind,
    label: intelligenceStatus(operation),
    energy,
    energySource: hasMeasured ? source : 'unavailable',
    reactive: hasMeasured,
    inward: clamp01(inward),
    outward: clamp01(outward),
    rotate: moving && !['ended', 'error', 'idle', 'blocked'].includes(kind),
    operation,
  };
}

