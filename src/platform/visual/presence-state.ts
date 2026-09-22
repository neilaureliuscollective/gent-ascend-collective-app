/** Presentation only. Preview states never mean a microphone or model is active. */
export type PresenceState = 'disconnected' | 'ready' | 'working' | 'saved' | 'stopped';
export type OrbState =
  | PresenceState
  | 'preview-listening'
  | 'preview-speaking'
  | 'preview-insight'
  | 'preview-milestone';
export function readOrbState(value: string | undefined): OrbState {
  switch (value) {
    case 'ready':
    case 'working':
    case 'saved':
    case 'stopped':
    case 'preview-listening':
    case 'preview-speaking':
    case 'preview-insight':
    case 'preview-milestone':
      return value;
    default:
      return 'disconnected';
  }
}
/** Bounded synthetic rhythm for the explicitly labeled visual preview only. */
export function orbEnergy(state: OrbState, seconds: number): number {
  if (!Number.isFinite(seconds)) return 0;
  if (state === 'working') return 0.3;
  if (state === 'saved') return 0.12;
  // One considered light response, never a perpetual celebration loop.
  if (state === 'preview-insight' || state === 'preview-milestone') {
    const duration = state === 'preview-insight' ? 2 : 3;
    if (seconds < 0 || seconds >= duration) return 0;
    return Math.sin((seconds / duration) * Math.PI) * (state === 'preview-insight' ? 0.35 : 0.6);
  }
  if (state !== 'preview-listening' && state !== 'preview-speaking') return 0;
  const phase = ((seconds % 4.8) + 4.8) % 4.8;
  if (phase > 3.2) return 0;
  const envelope = Math.sin((phase / 3.2) * Math.PI);
  const syllable = 0.3 + 0.7 * Math.pow(Math.sin(seconds * 8), 2);
  return envelope * syllable * (state === 'preview-listening' ? 0.5 : 1);
}
