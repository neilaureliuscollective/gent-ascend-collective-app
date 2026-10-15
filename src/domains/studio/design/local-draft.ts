export type RecoveredDraft<T> = {
  document: T;
  /** Revision the recovered content was based on — never the latest server revision. */
  baseRevision: number;
  updatedAt: string | null;
  kind: 'unsaved' | 'reconcile';
};

export function interpretLocalDraft<T>(
  stored: { document: T; revision: number; updatedAt?: string | null },
  server: { document: T; revision: number },
): RecoveredDraft<T> | null {
  if (stored.revision > server.revision) return null;
  if (JSON.stringify(stored.document) === JSON.stringify(server.document)) return null;
  return {
    document: stored.document,
    baseRevision: stored.revision,
    updatedAt: stored.updatedAt ?? null,
    kind: stored.revision === server.revision ? 'unsaved' : 'reconcile',
  };
}

/** After an explicit Keep, CAS against the current server revision — never silently. */
export function rebaseDraftForExplicitKeep<T>(input: {
  document: T;
  updatedAt: string | null;
  serverRevision: number;
  serverUpdatedAt: string;
}) {
  return {
    document: input.document,
    revision: input.serverRevision,
    updatedAt: input.serverUpdatedAt,
  };
}

export function createSerialLock() {
  let tail = Promise.resolve();
  return async function run<T>(work: () => Promise<T>): Promise<T> {
    const previous = tail;
    let release!: () => void;
    tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await work();
    } finally {
      release();
    }
  };
}
