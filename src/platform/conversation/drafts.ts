/** Unsent text only. Tab-scoped, bounded and restored only after a session-bound owner read.
 * This is recovery storage, never authorization or automatic message submission. */
const key = 'aethelios-talk-drafts-v1';
const lifetime = 24 * 60 * 60 * 1000;
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type Entry = { conversation: string | null; text: string; at: number };
function storage(): Store | undefined {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}
function entries(owner: string, store: Store | undefined, now: number): Entry[] {
  try {
    const value = JSON.parse(store?.getItem(key) ?? 'null');
    if (!value || value.owner !== owner || !Array.isArray(value.entries)) {
      store?.removeItem(key);
      return [];
    }
    return value.entries
      .filter(
        (entry: Entry) =>
          entry &&
          (entry.conversation === null || typeof entry.conversation === 'string') &&
          typeof entry.text === 'string' &&
          entry.text.length <= 6000 &&
          Number.isFinite(entry.at) &&
          entry.at <= now &&
          now - entry.at < lifetime,
      )
      .slice(-20);
  } catch {
    return [];
  }
}
export function readTalkDraft(
  owner: string,
  conversation: string | null,
  store = storage(),
  now = Date.now(),
) {
  if (!owner) return '';
  return (
    entries(owner, store, now).find((entry) => entry.conversation === conversation)?.text ?? ''
  );
}
export function writeTalkDraft(
  owner: string,
  conversation: string | null,
  text: string,
  store = storage(),
  now = Date.now(),
) {
  if (!owner) return;
  try {
    const current = entries(owner, store, now).filter(
      (entry) => entry.conversation !== conversation,
    );
    if (text) current.push({ conversation, text: text.slice(0, 6000), at: now });
    store?.setItem(key, JSON.stringify({ owner, entries: current.slice(-20) }));
  } catch {
    /* Private browsing/quota failure never prevents typing or sending. */
  }
}
export function clearTalkDrafts(store = storage()) {
  try {
    store?.removeItem(key);
  } catch {
    /* Storage is optional. */
  }
}
