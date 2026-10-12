import type { IntelligenceOperation, IntelligencePhase } from './intelligence-motion';
/** Explicit request observations; no time, percentages or prompt-keyword inference. */
export function observedOperation(
  id: string,
  phase: IntelligencePhase,
  persistence: IntelligenceOperation['persistence'] = 'not-applicable',
): IntelligenceOperation {
  return { id, phase, basis: 'observed', persistence };
}
/** Structural adapter for the released OpenAI-native Live controller. It imports no controller and never creates a transport. */
export function liveMotionOperation(
  state: {
    sessionId: string | null;
    phase: 'idle' | 'connecting' | 'listening' | 'speaking' | 'ended' | 'error';
    muted: boolean;
    playbackBlocked: boolean;
    recovering?: boolean;
    speechDetected?: boolean;
    responsePending?: boolean;
  },
  levels?: { input: number; output: number },
): IntelligenceOperation {
  const phase = state.recovering
    ? 'connecting'
    : state.phase === 'listening' && !state.muted && state.responsePending
      ? 'thinking'
      : state.phase === 'idle'
        ? 'ready'
        : state.phase === 'ended'
          ? 'cancelled'
          : state.phase === 'error'
            ? 'failed'
            : state.phase === 'listening' && state.muted
              ? 'ready'
              : state.phase === 'speaking' && state.playbackBlocked
                ? 'waiting'
                : state.phase;
  return {
    ...observedOperation(state.sessionId ?? 'live-idle', phase),
    label: state.recovering
      ? 'Reconnecting'
      : state.speechDetected && !state.muted
        ? 'Speech detected'
        : state.phase === 'ended'
          ? 'Session ended'
          : state.phase === 'error'
            ? 'Connection unavailable'
            : state.muted && state.phase === 'listening'
              ? 'Microphone muted'
              : state.playbackBlocked && state.phase === 'speaking'
                ? 'Voice playback blocked'
                : undefined,
    audioLevel: phase === 'listening' ? levels?.input : phase === 'speaking' ? levels?.output : 0,
  };
}
/** Saved job records report work only when approved; approval is not execution. */
export function liveJobMotionOperation(job: { id: string; status: string }): IntelligenceOperation {
  const phase =
    job.status === 'approved'
      ? 'waiting'
      : job.status === 'complete'
        ? 'complete'
        : job.status === 'failed'
          ? 'failed'
          : 'ready';
  return {
    ...observedOperation(job.id, phase, job.status === 'complete' ? 'confirmed' : 'not-applicable'),
    label:
      job.status === 'approval'
        ? 'Waiting for approval'
        : job.status === 'declined'
          ? 'Task declined'
          : undefined,
  };
}
