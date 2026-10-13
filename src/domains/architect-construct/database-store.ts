import { createClient } from '@supabase/supabase-js';
import { parseEnvironment } from '@/platform/environment';
import { supabaseConnection } from '@/platform/supabase/connection';
import { approvalHash } from './hash';
import {
  constructBriefSchema,
  constructEventSchema,
  constructRunSchema,
  runResultSchema,
  sourceSnapshotSchema,
  type ConstructBrief,
  type ConstructEvent,
  type ConstructRun,
  type RunResult,
  type SourceSnapshot,
  type eventKinds,
  terminalStatuses,
} from './schema';
import { ConstructStoreError, type ConstructStore } from './store';

export type ConstructPersistenceClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  from: (table: string) => ConstructQuery;
};

type ConstructQuery = {
  select: (columns: string) => ConstructQuery;
  eq: (column: string, value: unknown) => ConstructQuery;
  order: (column: string, options?: { ascending?: boolean }) => ConstructQuery;
  limit: (count: number) => ConstructQuery;
  maybeSingle: () => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  then: Promise<{ data: unknown; error: { message: string } | null }>['then'];
};

function fail(error: { message: string } | null, fallback: string): never {
  throw new ConstructStoreError(error?.message || fallback);
}

function asIso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return value;
}

function asSource(row: unknown): SourceSnapshot {
  const record = row as SourceSnapshot;
  return sourceSnapshotSchema.parse({ ...record, created_at: asIso(record.created_at) });
}

function asBrief(row: unknown): ConstructBrief {
  const record = row as ConstructBrief & { scope: ConstructBrief['scope'] };
  return constructBriefSchema.parse({
    id: record.id,
    person_id: record.person_id,
    approval_hash: record.approval_hash,
    status: record.status,
    invalidation_reason: record.invalidation_reason ?? null,
    scope: record.scope,
    created_at: asIso(record.created_at),
  });
}

function asRun(row: unknown): ConstructRun {
  const record = row as ConstructRun;
  const raw = record.result;
  const result =
    raw && typeof raw === 'object'
      ? { ...(raw as Record<string, unknown>), runtime_available: raw.runtime_available ?? false }
      : raw;
  return constructRunSchema.parse({
    ...record,
    result,
    created_at: asIso(record.created_at),
    updated_at: asIso(record.updated_at),
    lease_token: record.lease_token ?? null,
    lease_until: record.lease_until ? asIso(record.lease_until) : null,
  });
}

function asEvent(row: unknown): ConstructEvent {
  const record = row as ConstructEvent;
  return constructEventSchema.parse({ ...record, created_at: asIso(record.created_at) });
}

export class DatabaseConstructStore implements ConstructStore {
  constructor(
    private readonly client: ConstructPersistenceClient,
    private readonly plane: 'owner' | 'worker',
  ) {}

  private assertOwner() {
    if (this.plane !== 'owner')
      throw new ConstructStoreError('Owner mutations are not available on the worker plane.');
  }

  private assertWorker() {
    if (this.plane !== 'worker')
      throw new ConstructStoreError('Worker mutations are not available on the request plane.');
  }

  async importSource(source: SourceSnapshot) {
    this.assertOwner();
    const saved = await this.client.rpc('architect_construct_import_source', {
      p_id: source.id,
      p_kind: source.kind,
      p_repository: source.repository,
      p_commit: source.commit,
      p_label: source.label,
      p_tree: source.tree_hash,
      p_files: source.files,
    });
    if (saved.error) fail(saved.error, 'Source snapshot could not be stored.');
    const row = await this.readSource(source.person_id, source.id);
    if (!row) throw new ConstructStoreError('Source snapshot could not be reloaded.');
    return row;
  }

  async readSource(personId: string, sourceId: string) {
    const { data, error } = await this.client
      .from('architect_construct_sources')
      .select('*')
      .eq('id', sourceId)
      .maybeSingle();
    if (error) fail(error, 'Source unavailable.');
    if (!data) return null;
    const source = asSource(data);
    return source.person_id === personId || this.plane === 'worker' ? source : null;
  }

  async approveBrief(personId: string, briefId: string, scope: ConstructBrief['scope']) {
    this.assertOwner();
    const hash = approvalHash(scope);
    const saved = await this.client.rpc('architect_construct_approve_brief', {
      p_id: briefId,
      p_project: scope.project_id,
      p_expected: scope.project_revision,
      p_source: scope.source_id,
      p_hash: hash,
      p_scope: scope,
    });
    if (saved.error) fail(saved.error, 'Brief could not be approved.');
    const brief = await this.readBrief(personId, briefId);
    if (!brief) throw new ConstructStoreError('Approved brief could not be reloaded.');
    return brief;
  }

  async readBrief(personId: string, briefId: string) {
    const { data, error } = await this.client
      .from('architect_construct_briefs')
      .select('*')
      .eq('id', briefId)
      .maybeSingle();
    if (error) fail(error, 'Brief unavailable.');
    if (!data) return null;
    const brief = asBrief(data);
    return brief.person_id === personId || this.plane === 'worker' ? brief : null;
  }

  async invalidateProjectBriefs(personId: string, projectId: string, reason: string) {
    void personId;
    this.assertOwner();
    const saved = await this.client.rpc('architect_construct_invalidate_briefs', {
      p_project: projectId,
      p_reason: reason,
    });
    if (saved.error) fail(saved.error, 'Briefs could not be invalidated.');
    return Number(saved.data ?? 0);
  }

  async startRun(input: Parameters<ConstructStore['startRun']>[0]) {
    this.assertOwner();
    const saved = await this.client.rpc('architect_construct_start', {
      p_project: input.projectId,
      p_request: input.requestId,
      p_brief: input.briefId,
      p_expected: input.expected,
    });
    if (saved.error) fail(saved.error, 'Run could not be queued.');
    const run = await this.readRun(input.personId, input.requestId);
    if (!run) throw new ConstructStoreError('Queued run could not be reloaded.');
    return run;
  }

  async readRun(personId: string, runId: string) {
    const { data, error } = await this.client
      .from('architect_construct_runs')
      .select('*')
      .eq('id', runId)
      .maybeSingle();
    if (error) fail(error, 'Run unavailable.');
    if (!data) return null;
    const run = asRun(data);
    return run.person_id === personId || this.plane === 'worker' ? run : null;
  }

  async listRuns(personId: string, projectId: string) {
    const { data, error } = await this.client
      .from('architect_construct_runs')
      .select('*')
      .eq('person_id', personId)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) fail(error, 'Runs unavailable.');
    return (Array.isArray(data) ? data : []).map(asRun);
  }

  async listEvents(personId: string, runId: string) {
    const { data, error } = await this.client
      .from('architect_construct_events')
      .select('*')
      .eq('run_id', runId)
      .eq('person_id', personId)
      .order('seq', { ascending: true });
    if (error) fail(error, 'Events unavailable.');
    return (Array.isArray(data) ? data : []).map(asEvent);
  }

  async cancelRun(personId: string, runId: string) {
    this.assertOwner();
    const current = await this.readRun(personId, runId);
    if (!current) throw new ConstructStoreError('Run unavailable.', 'not_found');
    const saved = await this.client.rpc('architect_construct_cancel', {
      p_project: current.project_id,
      p_run: runId,
    });
    if (saved.error) fail(saved.error, 'Run could not be cancelled.');
    const reloaded = await this.readRun(personId, runId);
    if (!reloaded) throw new ConstructStoreError('Cancelled run could not be reloaded.');
    return reloaded;
  }

  async claimRun(workerId: string, now: Date, leaseMs = 45000) {
    void now;
    this.assertWorker();
    const claimed = await this.client.rpc('architect_construct_claim', {
      p_worker: workerId,
      p_lease: leaseMs,
    });
    if (claimed.error) fail(claimed.error, 'Claim unavailable.');
    const id = claimed.data as string | null;
    if (!id) return null;
    const { data, error } = await this.client
      .from('architect_construct_runs')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) fail(error, 'Claimed run unavailable.');
    return asRun(data);
  }

  async markRunning(workerId: string, runId: string, leaseToken: string, now: Date) {
    void now;
    this.assertWorker();
    const saved = await this.client.rpc('architect_construct_mark_running', {
      p_worker: workerId,
      p_run: runId,
      p_token: leaseToken,
    });
    if (saved.error) fail(saved.error, 'Running state unavailable.');
    return Boolean(saved.data);
  }

  async heartbeat(workerId: string, runId: string, leaseToken: string, now: Date, leaseMs: number) {
    void now;
    this.assertWorker();
    const saved = await this.client.rpc('architect_construct_heartbeat', {
      p_worker: workerId,
      p_run: runId,
      p_token: leaseToken,
      p_lease: leaseMs,
    });
    if (saved.error) fail(saved.error, 'Heartbeat unavailable.');
    return Boolean(saved.data);
  }

  async appendEvent(
    run: ConstructRun,
    kind: (typeof eventKinds)[number],
    detail: string,
    when?: Date,
  ) {
    void when;
    this.assertWorker();
    const saved = await this.client.rpc('architect_construct_append_event', {
      p_worker: run.worker_id,
      p_run: run.id,
      p_token: run.lease_token,
      p_kind: kind,
      p_detail: detail.slice(0, 2000),
    });
    if (saved.error) fail(saved.error, 'Event could not be appended.');
    if (!saved.data) throw new ConstructStoreError('Run is not claimed by this worker lease.');
    const events = await this.listEvents(run.person_id, run.id);
    const last = events.at(-1);
    if (!last) throw new ConstructStoreError('Event could not be reloaded.');
    return last;
  }

  async finishRun(
    workerId: string,
    runId: string,
    leaseToken: string,
    status: (typeof terminalStatuses)[number],
    result: RunResult,
    now: Date,
  ) {
    void now;
    this.assertWorker();
    const parsed = runResultSchema.parse(result);
    const saved = await this.client.rpc('architect_construct_finish', {
      p_worker: workerId,
      p_run: runId,
      p_token: leaseToken,
      p_status: status,
      p_result: parsed,
    });
    if (saved.error) fail(saved.error, 'Result could not be finished.');
    if (!saved.data) throw new ConstructStoreError('Run is not claimed by this worker lease.');
    const { data, error } = await this.client
      .from('architect_construct_runs')
      .select('*')
      .eq('id', runId)
      .maybeSingle();
    if (error || !data) fail(error, 'Finished run unavailable.');
    return asRun(data);
  }

  async recoverTimeouts(now: Date) {
    void now;
    this.assertWorker();
    const saved = await this.client.rpc('architect_construct_timeout', {});
    if (saved.error) fail(saved.error, 'Timeout recovery unavailable.');
    return [];
  }
}

export function memoryConstructStoreAllowed(env: NodeJS.ProcessEnv = process.env) {
  if (env.ARCHITECT_CONSTRUCT_STORE !== 'memory') return false;
  try {
    if (parseEnvironment(env).mode === 'production') return false;
  } catch {
    return false;
  }
  if (env.VERCEL || env.VERCEL_ENV) return false;
  return true;
}

export function createWorkerConstructStore(env: NodeJS.ProcessEnv = process.env): DatabaseConstructStore {
  if (memoryConstructStoreAllowed(env))
    throw new ConstructStoreError(
      'The standalone Construct worker cannot use the labelled memory store. Database persistence is required.',
      'unavailable',
    );
  const connection = supabaseConnection(env);
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!connection || !serviceKey)
    throw new ConstructStoreError(
      'Construct worker storage is unavailable. The control plane needs the local database URL and server-only service role; those credentials never enter the sandbox.',
      'unavailable',
    );
  const client = createClient(connection.url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return new DatabaseConstructStore(client as unknown as ConstructPersistenceClient, 'worker');
}
