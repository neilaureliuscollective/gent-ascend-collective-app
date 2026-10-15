/** Labelled experience targets — not claimed measurements. */
export const talkExperienceTargets = {
  sessionReadyMs: 1500,
  firstUsefulAudibleMs: 2500,
  interruptionToSilenceMs: 400,
  inputResponseMs: 100,
  saveAcknowledgmentMs: 800,
} as const;

export type TalkExperienceMark =
  | 'session-ready'
  | 'first-useful-audible'
  | 'interruption-to-silence'
  | 'input-responsive'
  | 'save-acknowledged'
  | 'artifact-complete'
  | 'recovery';

export function markTalkExperience(name: TalkExperienceMark, detail?: Record<string, string | number>) {
  if (typeof performance === 'undefined' || typeof performance.mark !== 'function') return;
  performance.mark(`talk:${name}`, { detail: { target: true, ...detail } });
}
