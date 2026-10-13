/** Owner-scoped recovery for one intended save or handoff. Never authorization. */
const key = 'aethelios-talk-saves-v1';
const lifetime = 24 * 60 * 60 * 1000;

export type PendingTalkSave = {
  id: string;
  conversationId: string;
  intent: 'revision' | 'handoff';
  payload: Record<string, unknown>;
  at: number;
};

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function storage(): Store | undefined {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

function records(owner: string, store: Store | undefined, now: number): PendingTalkSave[] {
  try {
    const value = JSON.parse(store?.getItem(key) ?? 'null');
    if (!value || value.owner !== owner || !Array.isArray(value.entries)) {
      store?.removeItem(key);
      return [];
    }
    return value.entries.filter(
      (entry: PendingTalkSave) =>
        entry &&
        typeof entry.id === 'string' &&
        typeof entry.conversationId === 'string' &&
        (entry.intent === 'revision' || entry.intent === 'handoff') &&
        entry.payload &&
        Number.isFinite(entry.at) &&
        now - entry.at < lifetime,
    );
  } catch {
    try {
      store?.removeItem(key);
    } catch {
      /* Storage is optional. */
    }
    return [];
  }
}

function write(owner: string, entries: PendingTalkSave[], store = storage()) {
  if (!owner) return;
  try {
    if (!entries.length) store?.removeItem(key);
    else store?.setItem(key, JSON.stringify({ owner, entries: entries.slice(-8) }));
  } catch {
    /* Storage is optional. */
  }
}

function samePayload(left: Record<string, unknown>, right: Record<string, unknown>) {
  const omit = (value: Record<string, unknown>) => {
    const rest = { ...value };
    delete rest.id;
    return rest;
  };
  return JSON.stringify(omit(left)) === JSON.stringify(omit(right));
}

export function rememberTalkSave(
  owner: string,
  conversationId: string,
  intent: PendingTalkSave['intent'],
  payload: Record<string, unknown>,
  store = storage(),
  now = Date.now(),
) {
  if (!owner) return crypto.randomUUID();
  const current = records(owner, store, now);
  const match = current.find(
    (entry) =>
      entry.conversationId === conversationId &&
      entry.intent === intent &&
      samePayload(entry.payload, payload),
  );
  if (match) return match.id;
  const id =
    typeof payload.id === 'string' && payload.id
      ? payload.id
      : crypto.randomUUID();
  write(
    owner,
    [
      ...current.filter(
        (entry) => !(entry.conversationId === conversationId && entry.intent === intent),
      ),
      { id, conversationId, intent, payload: { ...payload, id }, at: now },
    ],
    store,
  );
  return id;
}

export function readTalkSave(
  owner: string,
  conversationId: string,
  intent: PendingTalkSave['intent'],
  store = storage(),
  now = Date.now(),
) {
  if (!owner) return null;
  return (
    records(owner, store, now).find(
      (entry) => entry.conversationId === conversationId && entry.intent === intent,
    ) ?? null
  );
}

export function clearTalkSave(
  owner: string,
  conversationId: string,
  intent?: PendingTalkSave['intent'],
  store = storage(),
  now = Date.now(),
) {
  if (!owner) return;
  write(
    owner,
    records(owner, store, now).filter(
      (entry) =>
        entry.conversationId !== conversationId || (intent && entry.intent !== intent),
    ),
    store,
  );
}
