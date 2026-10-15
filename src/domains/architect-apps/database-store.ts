import { createClient } from '@supabase/supabase-js';
import { parseEnvironment } from '@/platform/environment';
import { supabaseConnection } from '@/platform/supabase/connection';
import { APP_PROFILE, APP_PROFILE_VERSION, APP_TOOLCHAIN_VERSION } from './catalog';
import { defaultAppLimits, terminalJobStatuses, type AppArtifact, type AppEvent, type AppJob, type AppJobResult, type AppRecord, type AppRevision, type ArchitectApp, type eventKinds } from './schema';
import { AppStoreError, type AppStore } from './store';

export type AppPersistenceClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  from: (table: string) => AppQuery;
};

type AppQuery = {
  select: (columns: string) => AppQuery;
  eq: (column: string, value: unknown) => AppQuery;
  order: (column: string, options?: { ascending?: boolean }) => AppQuery;
  limit: (count: number) => AppQuery;
  maybeSingle: () => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  then: Promise<{ data: unknown; error: { message: string } | null }>['then'];
};

function fail(error: { message: string } | null, fallback: string): never {
  throw new AppStoreError(error?.message || fallback);
}

function asIso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return typeof value === 'string' ? value : new Date().toISOString();
}

function asApp(row: unknown): ArchitectApp {
  const record = row as ArchitectApp;
  return {
    ...record,
    created_at: asIso(record.created_at),
    updated_at: asIso(record.updated_at),
  };
}

function asRevision(row: unknown): AppRevision {
  const record = row as AppRevision;
  return {
    ...record,
    profile: APP_PROFILE,
    profile_version: APP_PROFILE_VERSION,
    toolchain: record.toolchain || APP_TOOLCHAIN_VERSION,
    created_at: asIso(record.created_at),
  };
}

function asJob(row: unknown): AppJob {
  const record = row as AppJob;
  return {
    ...record,
    lease_token: record.lease_token ?? null,
    lease_until: record.lease_until ? asIso(record.lease_until) : null,
    created_at: asIso(record.created_at),
    updated_at: asIso(record.updated_at),
  };
}

function asEvent(row: unknown): AppEvent {
  const record = row as AppEvent;
  return { ...record, created_at: asIso(record.created_at) };
}

function asArtifact(row: unknown): AppArtifact {
  const record = row as AppArtifact;
  return { ...record, created_at: asIso(record.created_at) };
}

function asRecord(row: unknown): AppRecord {
  const record = row as AppRecord;
  return {
    ...record,
    version: Number(record.version || 1),
    created_at: asIso(record.created_at),
    updated_at: asIso(record.updated_at),
  };
}

export class DatabaseAppStore implements AppStore {
  constructor(
    private readonly client: AppPersistenceClient,
    private readonly plane: 'owner' | 'worker',
  ) {}

  private assertOwner() {
    if (this.plane !== 'owner') throw new AppStoreError('Owner mutations are not available on the worker plane.');
  }

  private assertWorker() {
    if (this.plane !== 'worker') throw new AppStoreError('Worker mutations are not available on the request plane.');
  }

  async readApp(personId: string, projectId: string) {
    const { data, error } = await this.client
      .from('architect_apps')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle();
    if (error) fail(error, 'Application unavailable.');
    if (!data) return null;
    const app = asApp(data);
    return app.person_id === personId || this.plane === 'worker' ? app : null;
  }

  async listRevisions(personId: string, projectId: string) {
    const { data, error } = await this.client
      .from('architect_app_revisions')
      .select('*')
      .eq('project_id', projectId)
      .order('revision', { ascending: false })
      .limit(80);
    if (error) fail(error, 'Revisions unavailable.');
    return (Array.isArray(data) ? data : [])
      .map(asRevision)
      .filter((row) => row.person_id === personId || this.plane === 'worker');
  }

  async readRevision(personId: string, revisionId: string) {
    const { data, error } = await this.client
      .from('architect_app_revisions')
      .select('*')
      .eq('id', revisionId)
      .maybeSingle();
    if (error) fail(error, 'Revision unavailable.');
    if (!data) return null;
    const revision = asRevision(data);
    return revision.person_id === personId || this.plane === 'worker' ? revision : null;
  }

  async approveRevision(input: Parameters<AppStore['approveRevision']>[0]) {
    this.assertOwner();
    const saved = await this.client.rpc('architect_apps_approve', {
      p_request: input.requestId,
      p_project: input.projectId,
      p_name: input.name,
      p_parent: input.parentRevision,
      p_tree: input.treeHash,
      p_hash: input.approvalHash,
      p_files: input.files,
      p_collections: input.collections,
      p_behaviors: input.behaviors,
      p_generation: input.generation,
    });
    if (saved.error) fail(saved.error, 'Application revision could not be approved.');
    const revision = await this.readRevision(input.personId, input.requestId);
    const app = await this.readApp(input.personId, input.projectId);
    if (!revision || !app) throw new AppStoreError('Approved application could not be reloaded.');
    return { app, revision };
  }

  async markRevisionStatus(
    personId: string,
    revisionId: string,
    status: AppRevision['status'],
    working = false,
    fence?: { workerId: string; jobId: string; leaseToken: string },
  ) {
    if (this.plane === 'worker') {
      if (!fence) throw new AppStoreError('Worker revision status requires the fenced job lease.');
      await this.persistWorkerRevisionStatus(fence.workerId, fence.jobId, fence.leaseToken, revisionId, status, working);
      const revision = await this.readRevision(personId, revisionId);
      if (!revision) throw new AppStoreError('Revision unavailable.', 'not_found');
      return revision;
    }
    const revision = await this.readRevision(personId, revisionId);
    if (!revision) throw new AppStoreError('Revision unavailable.', 'not_found');
    return revision;
  }

  async saveArtifact(
    artifact: AppArtifact,
    fence?: { workerId: string; jobId: string; leaseToken: string },
  ) {
    if (this.plane === 'owner') throw new AppStoreError('Compiled artifacts are written by the fenced worker.');
    if (!fence) throw new AppStoreError('Worker artifact writes require the claimed job identity.');
    return this.persistWorkerArtifact(fence.workerId, fence.jobId, fence.leaseToken, artifact);
  }

  async readArtifact(personId: string, revisionId: string) {
    const { data, error } = await this.client
      .from('architect_app_artifacts')
      .select('*')
      .eq('revision_id', revisionId)
      .maybeSingle();
    if (error) fail(error, 'Artifact unavailable.');
    if (!data) return null;
    const artifact = asArtifact(data);
    return artifact.person_id === personId || this.plane === 'worker' ? artifact : null;
  }

  async startJob(input: Parameters<AppStore['startJob']>[0]) {
    this.assertOwner();
    const saved = await this.client.rpc('architect_apps_start', {
      p_request: input.requestId,
      p_project: input.projectId,
      p_revision: input.revisionId,
      p_hash: input.approvalHash,
    });
    if (saved.error) fail(saved.error, 'Build could not be queued.');
    const job = await this.readJob(input.personId, input.requestId);
    if (!job) throw new AppStoreError('Queued build could not be reloaded.');
    return job;
  }

  async readJob(personId: string, jobId: string) {
    const { data, error } = await this.client.from('architect_app_jobs').select('*').eq('id', jobId).maybeSingle();
    if (error) fail(error, 'Build unavailable.');
    if (!data) return null;
    const job = asJob(data);
    return job.person_id === personId || this.plane === 'worker' ? job : null;
  }

  async listJobs(personId: string, projectId: string) {
    const { data, error } = await this.client
      .from('architect_app_jobs')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) fail(error, 'Builds unavailable.');
    return (Array.isArray(data) ? data : [])
      .map(asJob)
      .filter((job) => job.person_id === personId || this.plane === 'worker');
  }

  async listEvents(personId: string, jobId: string) {
    const { data, error } = await this.client
      .from('architect_app_events')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true });
    if (error) fail(error, 'Events unavailable.');
    return (Array.isArray(data) ? data : [])
      .map(asEvent)
      .filter((event) => event.person_id === personId || this.plane === 'worker');
  }

  async cancelJob(personId: string, jobId: string) {
    this.assertOwner();
    const current = await this.readJob(personId, jobId);
    if (!current) throw new AppStoreError('Build unavailable.', 'not_found');
    const saved = await this.client.rpc('architect_apps_cancel', {
      p_project: current.project_id,
      p_job: jobId,
    });
    if (saved.error) fail(saved.error, 'Build could not be cancelled.');
    const reloaded = await this.readJob(personId, jobId);
    if (!reloaded) throw new AppStoreError('Cancelled build could not be reloaded.');
    return reloaded;
  }

  async claimJob(workerId: string, now: Date, leaseMs = defaultAppLimits.lease_ms) {
    void now;
    this.assertWorker();
    const claimed = await this.client.rpc('architect_apps_claim', {
      p_worker: workerId,
      p_lease: leaseMs,
    });
    if (claimed.error) fail(claimed.error, 'Claim unavailable.');
    const id = claimed.data as string | null;
    if (!id) return null;
    const { data, error } = await this.client.from('architect_app_jobs').select('*').eq('id', id).maybeSingle();
    if (error || !data) fail(error, 'Claimed build unavailable.');
    return asJob(data);
  }

  async markRunning(workerId: string, jobId: string, leaseToken: string, now: Date) {
    void now;
    this.assertWorker();
    const saved = await this.client.rpc('architect_apps_mark_running', {
      p_worker: workerId,
      p_job: jobId,
      p_token: leaseToken,
    });
    if (saved.error) fail(saved.error, 'Running state unavailable.');
    return Boolean(saved.data);
  }

  async heartbeat(workerId: string, jobId: string, leaseToken: string, now: Date, leaseMs: number) {
    void now;
    this.assertWorker();
    const saved = await this.client.rpc('architect_apps_heartbeat', {
      p_worker: workerId,
      p_job: jobId,
      p_token: leaseToken,
      p_lease: leaseMs,
    });
    if (saved.error) fail(saved.error, 'Heartbeat unavailable.');
    return Boolean(saved.data);
  }

  async appendEvent(job: AppJob, kind: (typeof eventKinds)[number], detail: string, when?: Date) {
    void when;
    this.assertWorker();
    const saved = await this.client.rpc('architect_apps_append_event', {
      p_worker: job.worker_id,
      p_job: job.id,
      p_token: job.lease_token,
      p_kind: kind,
      p_detail: detail.slice(0, 2000),
    });
    if (saved.error) fail(saved.error, 'Event could not be appended.');
    if (!saved.data) throw new AppStoreError('Build is not claimed by this worker lease.');
    const events = await this.listEvents(job.person_id, job.id);
    const last = events.at(-1);
    if (!last) throw new AppStoreError('Event could not be reloaded.');
    return last;
  }

  async finishJob(
    workerId: string,
    jobId: string,
    leaseToken: string,
    status: (typeof terminalJobStatuses)[number],
    result: AppJobResult,
    now: Date,
  ) {
    void now;
    this.assertWorker();
    if (result.sandbox && result.isolation !== 'docker')
      throw new AppStoreError('A non-isolated runner cannot record sandbox success.');
    const saved = await this.client.rpc('architect_apps_finish', {
      p_worker: workerId,
      p_job: jobId,
      p_token: leaseToken,
      p_status: status,
      p_result: result,
    });
    if (saved.error) fail(saved.error, 'Result could not be finished.');
    if (!saved.data) throw new AppStoreError('Worker lost the lease before a durable result was recorded.');
    const { data, error } = await this.client.from('architect_app_jobs').select('*').eq('id', jobId).maybeSingle();
    if (error || !data) fail(error, 'Finished build unavailable.');
    return asJob(data);
  }

  async recoverTimeouts(now: Date) {
    void now;
    this.assertWorker();
    const saved = await this.client.rpc('architect_apps_timeout', {});
    if (saved.error) fail(saved.error, 'Timeout recovery unavailable.');
    return [];
  }

  async listRecords(personId: string, appId: string, collection: string) {
    const { data, error } = await this.client
      .from('architect_app_records')
      .select('*')
      .eq('app_id', appId)
      .eq('collection', collection)
      .order('updated_at', { ascending: false })
      .limit(defaultAppLimits.max_records);
    if (error) fail(error, 'Records unavailable.');
    return (Array.isArray(data) ? data : [])
      .map(asRecord)
      .filter((row) => row.person_id === personId || this.plane === 'worker');
  }

  async readRecord(personId: string, appId: string, collection: string, id: string) {
    const { data, error } = await this.client.from('architect_app_records').select('*').eq('id', id).maybeSingle();
    if (error) fail(error, 'Record unavailable.');
    if (!data) return null;
    const record = asRecord(data);
    return record.person_id === personId && record.app_id === appId && record.collection === collection ? record : null;
  }

  async writeRecord(input: Parameters<AppStore['writeRecord']>[0]) {
    this.assertOwner();
    const saved = await this.client.rpc('architect_apps_write_record', {
      p_project: input.projectId,
      p_app: input.appId,
      p_collection: input.collection,
      p_payload: input.payload,
      p_key: input.idempotencyKey ?? null,
      p_id: input.id ?? null,
      p_expected: input.expectedVersion ?? null,
    });
    if (saved.error) fail(saved.error, 'Record could not be saved.');
    const id = saved.data as string;
    const record = await this.readRecord(input.personId, input.appId, input.collection, id);
    if (!record) throw new AppStoreError('Saved record could not be reloaded.');
    return record;
  }

  async persistWorkerArtifact(
    workerId: string,
    jobId: string,
    leaseToken: string,
    artifact: AppArtifact,
  ) {
    this.assertWorker();
    const saved = await this.client.rpc('architect_apps_save_artifact', {
      p_worker: workerId,
      p_job: jobId,
      p_token: leaseToken,
      p_revision: artifact.revision_id,
      p_manifest: artifact.manifest_hash,
      p_files: artifact.files,
    });
    if (saved.error) fail(saved.error, 'Compiled artifacts could not be stored.');
    if (!saved.data) throw new AppStoreError('Worker lost the lease before artifacts were recorded.');
    return artifact;
  }

  async persistWorkerRevisionStatus(
    workerId: string,
    jobId: string,
    leaseToken: string,
    revisionId: string,
    status: AppRevision['status'],
    working = false,
  ) {
    this.assertWorker();
    const saved = await this.client.rpc('architect_apps_mark_revision', {
      p_worker: workerId,
      p_job: jobId,
      p_token: leaseToken,
      p_revision: revisionId,
      p_status: status,
      p_working: working,
    });
    if (saved.error) fail(saved.error, 'Revision status could not be recorded.');
    if (!saved.data) throw new AppStoreError('Worker lost the lease before revision status was recorded.');
  }
}

export function memoryAppStoreAllowed(env: NodeJS.ProcessEnv = process.env) {
  if (env.ARCHITECT_APPS_STORE !== 'memory') return false;
  try {
    if (parseEnvironment(env).mode === 'production') return false;
  } catch {
    return false;
  }
  if (env.VERCEL || env.VERCEL_ENV) return false;
  return true;
}

export function createWorkerAppStore(env: NodeJS.ProcessEnv = process.env): DatabaseAppStore {
  if (memoryAppStoreAllowed(env))
    throw new AppStoreError(
      'The standalone Apps worker cannot use the labelled memory store. Database persistence is required.',
      'unavailable',
    );
  const connection = supabaseConnection(env);
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!connection || !serviceKey)
    throw new AppStoreError(
      'Apps worker storage is unavailable. The control plane needs the local database URL and server-only service role; those credentials never enter the sandbox.',
      'unavailable',
    );
  const client = createClient(connection.url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return new DatabaseAppStore(client as unknown as AppPersistenceClient, 'worker');
}
