/** A device-local first-use acknowledgement, never authorization or optional context consent. */
export const liveAcknowledgementVersion = 'audio-transcript.v1';
const acknowledged = new Set<string>();
export function liveAcknowledgementKey(userId: string) {
  return `aethelios:live:${liveAcknowledgementVersion}:${userId}`;
}
export function hasLiveAcknowledgement(userId: string | null) {
  if (!userId) return false;
  const key = liveAcknowledgementKey(userId);
  try {
    return acknowledged.has(key) || localStorage.getItem(key) === liveAcknowledgementVersion;
  } catch {
    return acknowledged.has(key);
  }
}
export function saveLiveAcknowledgement(userId: string | null) {
  if (!userId) return;
  const key = liveAcknowledgementKey(userId);
  acknowledged.add(key);
  try {
    localStorage.setItem(key, liveAcknowledgementVersion);
  } catch {
    // Storage can be disabled; retain acknowledgement in this page's authenticated scope.
  }
}
