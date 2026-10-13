/** Unsent text only. Tab-scoped, bounded and restored only after a session-bound owner read.
 * This is recovery storage, never authorization or automatic message submission. */
const key = 'aethelios-talk-drafts-v2';
const legacyKey = 'aethelios-talk-drafts-v1';
/** The old cache cannot distinguish Home handoffs from ordinary Talk drafts. */
export function clearLegacyTalkDrafts(store = storage()) {
  try {
    store?.removeItem(legacyKey);
  } catch {
    /* Storage is optional. */
  }
}
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
  clearLegacyTalkDrafts(store);
  try {
    const value = JSON.parse(store?.getItem(key) ?? 'null');
    if (!value || value.owner !== owner || !Array.isArray(value.entries)) {
      store?.removeItem(key);
      return [];
    }
    const retained: Entry[] = value.entries
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
    if (!retained.length) store?.removeItem(key);
    else if (retained.length !== value.entries.length)
      store?.setItem(key, JSON.stringify({ owner, entries: retained }));
    return retained;
  } catch {
    try {
      store?.removeItem(key);
    } catch {
      /* Storage is optional. */
    }
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
    if (current.length) store?.setItem(key, JSON.stringify({ owner, entries: current.slice(-20) }));
    else store?.removeItem(key);
  } catch {
    /* Private browsing/quota failure never prevents typing or sending. */
  }
}
export function clearTalkDrafts(store = storage()) {
  clearLegacyTalkDrafts(store);
  try {
    store?.removeItem(key);
  } catch {
    /* Storage is optional. */
  }
}
