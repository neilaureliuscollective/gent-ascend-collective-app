/**
 * Preview and FFmpeg share this contract:
 * linearGain = dbToRatio(gainDb) * fadeEnvelope(time, duration, fadeInMs, fadeOutMs).
 * Web Audio GainNodes sum at full linear ratio. FFmpeg uses volume=linearGain then
 * matching afade times, then amix with normalize=0 so FFmpeg does not apply its
 * default 1/n attenuation. duration=longest keeps a shorter track from truncating
 * the mix; dropout_transition=0 avoids a hidden fade when the short track ends.
 */
export const MIX_POLICY = {
  preview: 'trackGainAt → GainNode (full linear ratio), or elementVolume fallback',
  ffmpeg: 'volume + afade + amix normalize=0 duration=longest dropout_transition=0',
} as const;

export const AMIX_FILTER = 'amix=inputs=2:duration=longest:dropout_transition=0:normalize=0';

/** Shared preview/export gain. Schema allows -24..+6 dB; both paths use this linear ratio. */
export function dbToRatio(db: number) {
  return Math.round(10 ** (db / 20) * 1000) / 1000;
}

export function fadeEnvelope(
  timeMs: number,
  durationMs: number,
  fadeInMs: number,
  fadeOutMs: number,
) {
  const t = Math.max(0, timeMs);
  const end = Math.max(t, durationMs);
  let gain = 1;
  if (fadeInMs > 0 && t < fadeInMs) gain *= t / fadeInMs;
  if (fadeOutMs > 0 && t > end - fadeOutMs) gain *= Math.max(0, (end - t) / fadeOutMs);
  return Math.max(0, Math.min(gain, 1));
}

export function trackGainAt(
  timeMs: number,
  durationMs: number,
  track: { gainDb: number; fadeInMs: number; fadeOutMs: number },
) {
  return dbToRatio(track.gainDb) * fadeEnvelope(timeMs, durationMs, track.fadeInMs, track.fadeOutMs);
}

/** HTMLMediaElement.volume cannot exceed 1; Web Audio uses the full ratio. */
export function elementVolume(linear: number) {
  return Math.max(0, Math.min(1, linear));
}
