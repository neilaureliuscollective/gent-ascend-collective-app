// Shared by the React workspace and the static offline runner. Only an explicitly
// started workout is retained here. Never cache authenticated HTML/API responses.
const DATABASE = 'gent-performance-v1';
function open() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore('drafts', { keyPath: 'owner' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error(
          'Device storage is unavailable. Enable storage before starting an offline workout.',
        ),
      );
  });
}
async function change(owner, reducer) {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('drafts', 'readwrite');
      const store = tx.objectStore('drafts');
      let result;
      let failure;
      const request = store.get(owner);
      request.onsuccess = () => {
        try {
          result = reducer(request.result ?? null);
          if (result) store.put(result);
          else store.delete(owner);
        } catch (error) {
          failure = error;
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = tx.onerror = () =>
        reject(
          failure ||
            new Error('The workout was not saved on this device. Keep this page open and retry.'),
        );
    });
  } finally {
    db.close();
  }
}
export async function readDraft(owner) {
  return change(owner, (row) => row);
}
export async function currentDraft() {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('drafts');
      const req = tx.objectStore('drafts').getAll();
      req.onsuccess = () => resolve(req.result.sort((a, b) => b.savedAt - a.savedAt)[0] ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}
export async function beginDraft(owner, draft, baseVersion = 0) {
  return change(owner, (row) => {
    if (
      row &&
      (row.draft.status === 'active' || row.revision !== row.syncedRevision || row.pending)
    )
      throw new Error('Finish and sync your saved workout before starting another.');
    return {
      owner,
      draft,
      baseVersion,
      revision: 1,
      syncedRevision: baseVersion ? 1 : 0,
      pending: null,
      savedAt: Date.now(),
    };
  });
}
export async function writeDraft(owner, draft, expectedRevision) {
  return change(owner, (row) => {
    if (!row || row.draft.id !== draft.id || row.revision !== expectedRevision)
      throw new Error(
        'This workout changed in another tab. Reload the device draft before editing.',
      );
    return { ...row, draft, revision: row.revision + 1, savedAt: Date.now() };
  });
}
export async function forgetDraft(owner) {
  return change(owner, () => null);
}
export async function clearDrafts() {
  const db = await open();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction('drafts', 'readwrite');
      tx.objectStore('drafts').clear();
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function isolateOwner(owner) {
  const db = await open();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction('drafts', 'readwrite');
      const st = tx.objectStore('drafts');
      const req = st.openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (c) {
          if (c.key !== owner) c.delete();
          c.continue();
        }
      };
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function syncDraft(owner) {
  const run = async () => {
    for (let count = 0; count < 5; count++) {
      const row = await change(owner, (row) => {
        if (!row || row.pending || row.revision === row.syncedRevision) return row;
        return {
          ...row,
          pending: {
            kind: 'session',
            owner,
            requestId: crypto.randomUUID(),
            expectedVersion: row.baseVersion,
            payload: row.draft,
            revision: row.revision,
          },
        };
      });
      if (!row?.pending) return row;
      const { revision, ...body } = row.pending;
      let response;
      try {
        response = await fetch('/api/performance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(15000),
        });
      } catch {
        throw new Error('Saved on this device. Reconnect to sync.');
      }
      const result = await response.json();
      if (!response.ok) {
        const error = new Error(
          result.error || 'Sync could not finish. Your workout remains on this device.',
        );
        error.status = response.status;
        throw error;
      }
      if (result.owner !== owner)
        throw new Error('Account changed. Your workout remains on this device.');
      const next = await change(owner, (current) => {
        if (!current || current.pending?.requestId !== body.requestId) return current;
        return { ...current, baseVersion: result.version, syncedRevision: revision, pending: null };
      });
      if (!next || next.revision === next.syncedRevision) return next;
    }
    return readDraft(owner);
  };
  return navigator.locks ? navigator.locks.request(`performance-sync-${owner}`, run) : run();
}
