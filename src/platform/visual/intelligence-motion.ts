/** Presentation snapshots supplied by operation owners, never inferred from animation time. */
export type IntelligencePhase =
  | 'ready'
  | 'loading'
  | 'connecting'
  | 'sending'
  | 'waiting'
  | 'thinking'
  | 'searching'
  | 'researching'
  | 'generating'
  | 'processing'
  | 'listening'
  | 'speaking'
  | 'saving'
  | 'stopping'
  | 'complete'
  | 'failed'
  | 'cancelled';
export type IntelligenceOperation = {
  id: string;
  phase: IntelligencePhase;
  /** Live snapshots require an observed controller/request event. */
  basis: 'observed' | 'preview';
  label?:
    | 'Reconnecting'
    | 'Speech detected'
    | 'Microphone muted'
    | 'Voice playback blocked'
    | 'Session ended'
    | 'Connection unavailable'
    | 'Waiting for approval'
    | 'Task declined';
  /** Optional measured level; never synthesize syllables in a live adapter. */
  audioLevel?: number;
  persistence?: 'not-applicable' | 'pending' | 'confirmed' | 'uncertain';
};
export const intelligencePhases: readonly IntelligencePhase[] = [
  'ready',
  'loading',
  'connecting',
  'sending',
  'waiting',
  'thinking',
  'searching',
  'researching',
  'generating',
  'processing',
  'listening',
  'speaking',
  'saving',
  'stopping',
  'complete',
  'failed',
  'cancelled',
];
const labels: Record<IntelligencePhase, string> = {
  ready: 'Ready',
  loading: 'Loading',
  connecting: 'Connecting',
  sending: 'Sending',
  waiting: 'Preparing a reply',
  thinking: 'Working',
  searching: 'Searching the web',
  researching: 'Researching',
  generating: 'Responding',
  processing: 'Processing',
  listening: 'Listening',
  speaking: 'Speaking',
  saving: 'Saving',
  stopping: 'Stopping',
  complete: 'Complete',
  failed: 'Operation failed',
  cancelled: 'Stopped',
};
export function intelligenceStatus(operation: IntelligenceOperation): string {
  if (operation.persistence === 'uncertain') {
    if (operation.phase === 'stopping') return 'Stopping · Save unconfirmed';
    if (operation.phase === 'cancelled') return 'Stopped · Save unconfirmed';
    if (operation.phase === 'failed') return 'Operation failed · Save unconfirmed';
    return 'Save unconfirmed';
  }
  if (operation.phase === 'complete' && operation.persistence === 'confirmed') return 'Saved';
  if (operation.phase === 'complete' && operation.persistence === 'pending') return 'Saving';
  return operation.label ?? labels[operation.phase];
}
export function intelligenceBusy(operation: IntelligenceOperation): boolean {
  return (
    !['ready', 'complete', 'failed', 'cancelled'].includes(operation.phase) ||
    (operation.phase === 'complete' && operation.persistence === 'pending')
  );
}
export function measuredAudioLevel(operation: IntelligenceOperation): number {
  if (!['listening', 'speaking'].includes(operation.phase)) return 0;
  const value = operation.audioLevel;
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}
