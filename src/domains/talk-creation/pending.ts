/** Owner-scoped recovery for one intended save or handoff. Never authorization. */
const prefix = 'aethelios-talk-saves-v1:';
const lifetime = 24 * 60 * 60 * 1000;

export type PendingTalkSave = {
  id: string;
  conversationId: string;
  intent: 'revision' | 'handoff' | 'import';
  payload: Record<string, unknown>;
  at: number;
};

const memory = new Map<string, PendingTalkSave[]>();

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function storage(): Store | undefined {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

function keyFor(owner: string) {
  return `${prefix}${owner}`;
}

function live(entries: PendingTalkSave[], now: number) {
  return entries.filter(
    (entry) =>
      entry &&
      typeof entry.id === 'string' &&
      typeof entry.conversationId === 'string' &&
      (entry.intent === 'revision' || entry.intent === 'handoff' || entry.intent === 'import') &&
      entry.payload &&
      Number.isFinite(entry.at) &&
      now - entry.at < lifetime,
  );
}

function records(owner: string, store: Store | undefined, now: number): PendingTalkSave[] {
  if (!owner) return [];
  const key = keyFor(owner);
  try {
    if (!store) return live(memory.get(key) ?? [], now);
    const value = JSON.parse(store.getItem(key) ?? 'null');
    if (!value || !Array.isArray(value.entries)) {
      store.removeItem(key);
      return live(memory.get(key) ?? [], now);
    }
    return live(value.entries, now);
  } catch {
    return live(memory.get(key) ?? [], now);
  }
}

function write(owner: string, entries: PendingTalkSave[], store = storage()) {
  if (!owner) return;
  const key = keyFor(owner);
  const next = entries.slice(-8);
  try {
    if (!store) {
      if (!next.length) memory.delete(key);
      else memory.set(key, next);
      return;
    }
    if (!next.length) store.removeItem(key);
    else store.setItem(key, JSON.stringify({ entries: next }));
    memory.delete(key);
  } catch {
    if (!next.length) memory.delete(key);
    else memory.set(key, next);
  }
}

function omitIdentity(value: Record<string, unknown>) {
  const rest = { ...value };
  delete rest.id;
  delete rest.preparedAt;
  return rest;
}

export function sameTalkSaveIntent(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
) {
  return JSON.stringify(omitIdentity(left)) === JSON.stringify(omitIdentity(right));
}

export function bindTalkSave(
  owner: string,
  conversationId: string,
  intent: PendingTalkSave['intent'],
  payload: Record<string, unknown>,
  store = storage(),
  now = Date.now(),
): PendingTalkSave {
  const preparedAt =
    intent === 'handoff'
      ? typeof payload.preparedAt === 'string' && payload.preparedAt
        ? payload.preparedAt
        : new Date(now).toISOString()
      : undefined;
  if (!owner) {
    const id =
      typeof payload.id === 'string' && payload.id ? payload.id : crypto.randomUUID();
    return {
      id,
      conversationId,
      intent,
      payload: { ...payload, id, ...(preparedAt ? { preparedAt } : {}) },
      at: now,
    };
  }
  const current = records(owner, store, now);
  const match = current.find(
    (entry) =>
      entry.conversationId === conversationId &&
      entry.intent === intent &&
      sameTalkSaveIntent(entry.payload, payload),
  );
  if (match) return match;
  const id =
    typeof payload.id === 'string' && payload.id ? payload.id : crypto.randomUUID();
  const entry: PendingTalkSave = {
    id,
    conversationId,
    intent,
    payload: { ...payload, id, ...(preparedAt ? { preparedAt } : {}) },
    at: now,
  };
  write(
    owner,
    [
      ...current.filter(
        (item) => !(item.conversationId === conversationId && item.intent === intent),
      ),
      entry,
    ],
    store,
  );
  return entry;
}

export function rememberTalkSave(
  owner: string,
  conversationId: string,
  intent: PendingTalkSave['intent'],
  payload: Record<string, unknown>,
  store = storage(),
  now = Date.now(),
) {
  return bindTalkSave(owner, conversationId, intent, payload, store, now).id;
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

export function matchesTalkSave(
  owner: string,
  conversationId: string,
  intent: PendingTalkSave['intent'],
  expectedId: string,
  store = storage(),
  now = Date.now(),
) {
  return readTalkSave(owner, conversationId, intent, store, now)?.id === expectedId;
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
