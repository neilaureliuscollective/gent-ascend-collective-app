/**
 * Preview and FFmpeg share this contract:
 * linearGain = dbToRatio(gainDb) * fadeEnvelope(time, duration, fadeInMs, fadeOutMs).
 * Web Audio GainNode uses the full ratio. HTMLMediaElement.volume is clamped to 1 only when
 * AudioContext is unavailable. FFmpeg uses volume=linearGain then afade in/out at the same
 * times, then amix=inputs=2:duration=longest:dropout_transition=0.
 */
export const MIX_POLICY = {
  preview: 'trackGainAt → GainNode, or elementVolume fallback',
  ffmpeg: 'volume + afade + amix',
} as const;

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
