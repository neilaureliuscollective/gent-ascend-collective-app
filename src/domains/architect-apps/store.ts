import { randomUUID } from 'node:crypto';
import { APP_PROFILE, APP_PROFILE_VERSION, APP_TOOLCHAIN_VERSION } from './catalog';
import { defaultAppLimits, terminalJobStatuses, type AppArtifact, type AppEvent, type AppJob, type AppJobResult, type AppRecord, type AppRevision, type ArchitectApp, type eventKinds } from './schema';

export class AppStoreError extends Error {
  constructor(
    message: string,
    readonly code: 'conflict' | 'not_found' | 'unavailable' | 'too-large' = 'conflict',
  ) {
    super(message);
  }
}

export type AppStore = {
  readApp(personId: string, projectId: string): Promise<ArchitectApp | null>;
  listRevisions(personId: string, projectId: string): Promise<AppRevision[]>;
  readRevision(personId: string, revisionId: string): Promise<AppRevision | null>;
  approveRevision(input: {
    requestId: string;
    personId: string;
    projectId: string;
    name: string;
    parentRevision: number | null;
    treeHash: string;
    approvalHash: string;
    files: AppRevision['files'];
    collections: AppRevision['collections'];
    behaviors: AppRevision['behaviors'];
    generation: AppRevision['generation'];
  }): Promise<{ app: ArchitectApp; revision: AppRevision }>;
  markRevisionStatus(
    personId: string,
    revisionId: string,
    status: AppRevision['status'],
    working?: boolean,
  ): Promise<AppRevision>;
  saveArtifact(artifact: AppArtifact): Promise<AppArtifact>;
  readArtifact(personId: string, revisionId: string): Promise<AppArtifact | null>;
  startJob(input: {
    requestId: string;
    personId: string;
    projectId: string;
    appId: string;
    revisionId: string;
    approvalHash: string;
  }): Promise<AppJob>;
  readJob(personId: string, jobId: string): Promise<AppJob | null>;
  listJobs(personId: string, projectId: string): Promise<AppJob[]>;
  listEvents(personId: string, jobId: string): Promise<AppEvent[]>;
  cancelJob(personId: string, jobId: string): Promise<AppJob>;
  claimJob(workerId: string, now: Date, leaseMs?: number): Promise<AppJob | null>;
  markRunning(workerId: string, jobId: string, leaseToken: string, now: Date): Promise<boolean>;
  heartbeat(workerId: string, jobId: string, leaseToken: string, now: Date, leaseMs: number): Promise<boolean>;
  appendEvent(job: AppJob, kind: (typeof eventKinds)[number], detail: string, at?: Date): Promise<AppEvent>;
  finishJob(
    workerId: string,
    jobId: string,
    leaseToken: string,
    status: (typeof terminalJobStatuses)[number],
    result: AppJobResult,
    now: Date,
  ): Promise<AppJob>;
  recoverTimeouts(now: Date): Promise<AppJob[]>;
  listRecords(personId: string, appId: string, collection: string): Promise<AppRecord[]>;
  readRecord(personId: string, appId: string, collection: string, id: string): Promise<AppRecord | null>;
  writeRecord(input: {
    personId: string;
    projectId: string;
    appId: string;
    collection: string;
    payload: Record<string, unknown>;
    idempotencyKey?: string;
    id?: string;
  }): Promise<AppRecord>;
};

function at(now?: Date) {
  return (now ?? new Date()).toISOString();
}

export class MemoryAppStore implements AppStore {
  apps = new Map<string, ArchitectApp>();
  revisions = new Map<string, AppRevision>();
  artifacts = new Map<string, AppArtifact>();
  jobs = new Map<string, AppJob>();
  events: AppEvent[] = [];
  records = new Map<string, AppRecord>();

  private projectKey(personId: string, projectId: string) {
    return `${personId}:${projectId}`;
  }

  async readApp(personId: string, projectId: string) {
    return this.apps.get(this.projectKey(personId, projectId)) ?? null;
  }

  async listRevisions(personId: string, projectId: string) {
    return [...this.revisions.values()]
      .filter((row) => row.person_id === personId && row.project_id === projectId)
      .sort((a, b) => b.revision - a.revision);
  }

  async readRevision(personId: string, revisionId: string) {
    const row = this.revisions.get(revisionId);
    return row?.person_id === personId ? row : null;
  }

  async approveRevision(input: Parameters<AppStore['approveRevision']>[0]) {
    const existing = this.revisions.get(input.requestId);
    if (existing) {
      if (existing.person_id !== input.personId || existing.approval_hash !== input.approvalHash)
        throw new AppStoreError('Request already reserved with a different approved application.');
      const app = await this.readApp(input.personId, input.projectId);
      if (!app) throw new AppStoreError('Application unavailable.', 'not_found');
      return { app, revision: existing };
    }
    const key = this.projectKey(input.personId, input.projectId);
    const app = this.apps.get(key) ?? {
      id: input.projectId,
      person_id: input.personId,
      project_id: input.projectId,
      name: input.name,
      current_revision: 0,
      last_working_revision: null,
      created_at: at(),
      updated_at: at(),
    };
    if (input.parentRevision && input.parentRevision !== app.current_revision)
      throw new AppStoreError('Stale parent revision. Reload before approving this change.');
    const revision: AppRevision = {
      id: input.requestId,
      app_id: app.id,
      person_id: input.personId,
      project_id: input.projectId,
      revision: app.current_revision + 1,
      parent_revision: input.parentRevision,
      tree_hash: input.treeHash,
      approval_hash: input.approvalHash,
      profile: APP_PROFILE,
      profile_version: APP_PROFILE_VERSION,
      toolchain: APP_TOOLCHAIN_VERSION,
      files: input.files,
      collections: input.collections,
      behaviors: input.behaviors,
      generation: input.generation,
      status: 'approved',
      working: false,
      created_at: at(),
    };
    app.current_revision = revision.revision;
    app.name = input.name;
    app.updated_at = revision.created_at;
    this.apps.set(key, app);
    this.revisions.set(revision.id, revision);
    return { app, revision };
  }

  async markRevisionStatus(personId: string, revisionId: string, status: AppRevision['status'], working = false) {
    const revision = await this.readRevision(personId, revisionId);
    if (!revision) throw new AppStoreError('Revision unavailable.', 'not_found');
    revision.status = status;
    if (working) {
      revision.working = true;
      const app = await this.readApp(personId, revision.project_id);
      if (app) {
        app.last_working_revision = revision.revision;
        app.updated_at = at();
      }
    }
    return revision;
  }

  async saveArtifact(artifact: AppArtifact) {
    this.artifacts.set(artifact.revision_id, artifact);
    return artifact;
  }

  async readArtifact(personId: string, revisionId: string) {
    const artifact = this.artifacts.get(revisionId);
    return artifact?.person_id === personId ? artifact : null;
  }

  async startJob(input: Parameters<AppStore['startJob']>[0]) {
    const existing = this.jobs.get(input.requestId);
    if (existing) {
      if (
        existing.person_id !== input.personId ||
        existing.revision_id !== input.revisionId ||
        existing.approval_hash !== input.approvalHash
      )
        throw new AppStoreError('Request already reserved with a different approved revision.');
      return existing;
    }
    const job: AppJob = {
      id: input.requestId,
      person_id: input.personId,
      project_id: input.projectId,
      app_id: input.appId,
      revision_id: input.revisionId,
      approval_hash: input.approvalHash,
      status: 'queued',
      cancel_requested: false,
      worker_id: null,
      lease_token: null,
      lease_until: null,
      result: null,
      created_at: at(),
      updated_at: at(),
    };
    this.jobs.set(job.id, job);
    await this.appendEvent(job, 'queued', 'Build queued. The request handler does not compile generated applications.');
    return job;
  }

  async readJob(personId: string, jobId: string) {
    const job = this.jobs.get(jobId);
    return job?.person_id === personId ? job : null;
  }

  async listJobs(personId: string, projectId: string) {
    return [...this.jobs.values()]
      .filter((job) => job.person_id === personId && job.project_id === projectId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async listEvents(personId: string, jobId: string) {
    return this.events.filter((event) => event.person_id === personId && event.job_id === jobId);
  }

  async cancelJob(personId: string, jobId: string) {
    const job = await this.readJob(personId, jobId);
    if (!job) throw new AppStoreError('Build unavailable.', 'not_found');
    job.cancel_requested = true;
    if (job.status === 'queued') {
      job.status = 'cancelled';
      job.updated_at = at();
      await this.appendEvent(job, 'cancelled', 'Owner cancelled the build before execution started.');
    }
    return job;
  }

  async claimJob(workerId: string, now: Date, leaseMs = defaultAppLimits.lease_ms) {
    const queued = [...this.jobs.values()]
      .filter((job) => job.status === 'queued' || (job.status === 'running' && job.lease_until && job.lease_until < now.toISOString()))
      .sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
    if (!queued) return null;
    queued.status = 'queued';
    queued.worker_id = workerId;
    queued.lease_token = randomUUID();
    queued.lease_until = new Date(now.getTime() + leaseMs).toISOString();
    queued.updated_at = now.toISOString();
    return queued;
  }

  async markRunning(workerId: string, jobId: string, leaseToken: string, now: Date) {
    const job = this.jobs.get(jobId);
    if (!job || job.worker_id !== workerId || job.lease_token !== leaseToken) return false;
    job.status = 'running';
    job.updated_at = now.toISOString();
    return true;
  }

  async heartbeat(workerId: string, jobId: string, leaseToken: string, now: Date, leaseMs: number) {
    const job = this.jobs.get(jobId);
    if (!job || job.worker_id !== workerId || job.lease_token !== leaseToken) return false;
    job.lease_until = new Date(now.getTime() + leaseMs).toISOString();
    job.updated_at = now.toISOString();
    return true;
  }

  async appendEvent(job: AppJob, kind: (typeof eventKinds)[number], detail: string, when?: Date) {
    const event: AppEvent = {
      id: randomUUID(),
      job_id: job.id,
      person_id: job.person_id,
      kind,
      detail,
      created_at: at(when),
    };
    this.events.push(event);
    return event;
  }

  async finishJob(
    workerId: string,
    jobId: string,
    leaseToken: string,
    status: (typeof terminalJobStatuses)[number],
    result: AppJobResult,
    now: Date,
  ) {
    const job = this.jobs.get(jobId);
    if (!job) throw new AppStoreError('Build unavailable.', 'not_found');
    if (job.worker_id !== workerId || job.lease_token !== leaseToken)
      throw new AppStoreError('Worker lost the lease before a durable result was recorded.');
    if (terminalJobStatuses.includes(job.status as (typeof terminalJobStatuses)[number]) && job.result)
      return job;
    job.status = status;
    job.result = result;
    job.lease_token = null;
    job.lease_until = null;
    job.updated_at = now.toISOString();
    return job;
  }

  async recoverTimeouts(now: Date) {
    const lost: AppJob[] = [];
    for (const job of this.jobs.values()) {
      if (job.status === 'running' && job.lease_until && job.lease_until < now.toISOString()) {
        job.status = 'failed';
        job.result = {
          ok: false,
          isolation: 'unavailable',
          sandbox: false,
          typecheck: { ok: false, log: '' },
          bundle: { ok: false, log: '' },
          blocker: 'Worker lost the lease before a durable result was recorded.',
          stages: [],
        };
        job.lease_token = null;
        job.updated_at = now.toISOString();
        lost.push(job);
      }
    }
    return lost;
  }

  async listRecords(personId: string, appId: string, collection: string) {
    return [...this.records.values()]
      .filter((row) => row.person_id === personId && row.app_id === appId && row.collection === collection)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }

  async readRecord(personId: string, appId: string, collection: string, id: string) {
    const row = this.records.get(id);
    return row && row.person_id === personId && row.app_id === appId && row.collection === collection ? row : null;
  }

  async writeRecord(input: Parameters<AppStore['writeRecord']>[0]) {
    if (input.idempotencyKey) {
      const replay = [...this.records.values()].find(
        (row) =>
          row.person_id === input.personId &&
          row.app_id === input.appId &&
          row.collection === input.collection &&
          row.idempotency_key === input.idempotencyKey,
      );
      if (replay) return replay;
    }
    const existing = input.id ? this.records.get(input.id) : null;
    if (existing && existing.person_id !== input.personId) throw new AppStoreError('Record unavailable.', 'not_found');
    const rows = await this.listRecords(input.personId, input.appId, input.collection);
    if (!existing && rows.length >= defaultAppLimits.max_records)
      throw new AppStoreError('Collection quota exceeded.');
    const record: AppRecord = {
      id: existing?.id ?? input.id ?? randomUUID(),
      person_id: input.personId,
      project_id: input.projectId,
      app_id: input.appId,
      collection: input.collection,
      payload: input.payload,
      idempotency_key: input.idempotencyKey ?? existing?.idempotency_key ?? null,
      created_at: existing?.created_at ?? at(),
      updated_at: at(),
    };
    this.records.set(record.id, record);
    return record;
  }
}
