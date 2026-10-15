export type PreviewSessionRecord = {
  nonce: string;
  token: string;
  exp: number;
  generation: number;
  personId: string;
  projectId: string;
  revisionId: string;
  revoked: boolean;
};

export type PreviewSessionStoreKind = 'memory' | 'database';

export interface PreviewSessionStore {
  readonly kind: PreviewSessionStoreKind;
  issue(record: PreviewSessionRecord, replace: boolean): Promise<PreviewSessionRecord>;
  read(nonce: string): Promise<PreviewSessionRecord | null>;
  current(revisionId: string): Promise<PreviewSessionRecord | null>;
  revoke(revisionId: string): Promise<void>;
  reset(): Promise<void> | void;
}

type SharedPreviewMaps = {
  issued: Map<string, PreviewSessionRecord>;
  currentByRevision: Map<string, string>;
};

export function createSharedPreviewMaps(): SharedPreviewMaps {
  return { issued: new Map(), currentByRevision: new Map() };
}

export class MemoryPreviewSessionStore implements PreviewSessionStore {
  readonly kind = 'memory' as const;
  private readonly issued: Map<string, PreviewSessionRecord>;
  private readonly currentByRevision: Map<string, string>;
  private readonly locks = new Map<string, Promise<void>>();

  constructor(shared: SharedPreviewMaps = createSharedPreviewMaps()) {
    this.issued = shared.issued;
    this.currentByRevision = shared.currentByRevision;
  }

  private async withLock<T>(revisionId: string, fn: () => Promise<T> | T): Promise<T> {
    const previous = this.locks.get(revisionId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.locks.set(
      revisionId,
      previous.then(() => current),
    );
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  async issue(record: PreviewSessionRecord, replace: boolean): Promise<PreviewSessionRecord> {
    return this.withLock(record.revisionId, () => {
      const existingNonce = this.currentByRevision.get(record.revisionId);
      const existing = existingNonce ? this.issued.get(existingNonce) : undefined;
      if (
        !replace &&
        existing &&
        !existing.revoked &&
        existing.personId === record.personId &&
        existing.projectId === record.projectId &&
        existing.exp * 1000 > Date.now() + 5000
      ) {
        return existing;
      }
      if (existingNonce) {
        const previous = this.issued.get(existingNonce);
        if (previous) this.issued.set(existingNonce, { ...previous, revoked: true });
      }
      const next: PreviewSessionRecord = {
        ...record,
        generation: (existing?.generation ?? 0) + 1,
        revoked: false,
      };
      this.issued.set(next.nonce, next);
      this.currentByRevision.set(next.revisionId, next.nonce);
      return next;
    });
  }

  async read(nonce: string) {
    return this.issued.get(nonce) ?? null;
  }

  async current(revisionId: string) {
    const nonce = this.currentByRevision.get(revisionId);
    return nonce ? this.issued.get(nonce) ?? null : null;
  }

  async revoke(revisionId: string) {
    const nonce = this.currentByRevision.get(revisionId);
    if (!nonce) return;
    const existing = this.issued.get(nonce);
    if (existing) this.issued.set(nonce, { ...existing, revoked: true });
    this.currentByRevision.delete(revisionId);
  }

  reset() {
    this.issued.clear();
    this.currentByRevision.clear();
  }
}

export type PreviewSessionClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

function asRecord(row: Record<string, unknown>): PreviewSessionRecord {
  return {
    nonce: String(row.nonce),
    token: String(row.token),
    exp: Number(row.exp),
    generation: Number(row.generation ?? 1),
    personId: String(row.person_id ?? row.personId),
    projectId: String(row.project_id ?? row.projectId),
    revisionId: String(row.revision_id ?? row.revisionId),
    revoked: Boolean(row.revoked ?? row.revoked_at),
  };
}

export class DatabasePreviewSessionStore implements PreviewSessionStore {
  readonly kind = 'database' as const;

  constructor(private readonly client: PreviewSessionClient) {}

  async issue(record: PreviewSessionRecord, replace: boolean): Promise<PreviewSessionRecord> {
    const issued = await this.client.rpc('architect_apps_preview_issue', {
      p_revision: record.revisionId,
      p_nonce: record.nonce,
      p_token: record.token,
      p_exp: record.exp,
      p_replace: replace,
    });
    if (issued.error || !issued.data || typeof issued.data !== 'object')
      throw new Error(issued.error?.message || 'Preview session could not be issued.');
    return asRecord(issued.data as Record<string, unknown>);
  }

  async read(nonce: string) {
    const row = await this.client.rpc('architect_apps_preview_read', { p_nonce: nonce });
    if (row.error || !row.data || typeof row.data !== 'object') return null;
    return asRecord(row.data as Record<string, unknown>);
  }

  async current(revisionId: string) {
    const row = await this.client.rpc('architect_apps_preview_current', { p_revision: revisionId });
    if (row.error || !row.data || typeof row.data !== 'object') return null;
    return asRecord(row.data as Record<string, unknown>);
  }

  async revoke(revisionId: string) {
    const revoked = await this.client.rpc('architect_apps_preview_revoke', { p_revision: revisionId });
    if (revoked.error) throw new Error(revoked.error.message);
  }

  reset() {
    /* durable store is not process-local */
  }
}

const processStore = new MemoryPreviewSessionStore();

export function defaultPreviewSessionStore() {
  return processStore;
}
