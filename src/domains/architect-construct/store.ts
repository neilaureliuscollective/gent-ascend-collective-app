import { randomUUID } from 'node:crypto';
import { approvalHash } from './hash';
import { RESULT_RECEIPT_MAX_BYTES, serializedReceiptBytes } from './receipt-budget';
import {
  type ConstructBrief,
  type ConstructEvent,
  type ConstructRun,
  type RunResult,
  type SourceSnapshot,
  type eventKinds,
  terminalStatuses,
} from './schema';

export class ConstructStoreError extends Error {
  constructor(
    message: string,
    readonly code = 'conflict',
  ) {
    super(message);
  }
}

export type ConstructStore = {
  importSource(source: SourceSnapshot): Promise<SourceSnapshot>;
  readSource(personId: string, sourceId: string): Promise<SourceSnapshot | null>;
  approveBrief(personId: string, briefId: string, scope: ConstructBrief['scope']): Promise<ConstructBrief>;
  readBrief(personId: string, briefId: string): Promise<ConstructBrief | null>;
  invalidateProjectBriefs(personId: string, projectId: string, reason: string): Promise<number>;
  startRun(input: {
    personId: string;
    projectId: string;
    briefId: string;
    requestId: string;
    expected: number;
    sourceKind: SourceSnapshot['kind'];
    sourceTreeHash: string;
    approvalHash: string;
    sourceId: string;
  }): Promise<ConstructRun>;
  readRun(personId: string, runId: string): Promise<ConstructRun | null>;
  listRuns(personId: string, projectId: string): Promise<ConstructRun[]>;
  listEvents(personId: string, runId: string): Promise<ConstructEvent[]>;
  cancelRun(personId: string, runId: string): Promise<ConstructRun>;
  claimRun(workerId: string, now: Date, leaseMs?: number): Promise<ConstructRun | null>;
  markRunning(workerId: string, runId: string, leaseToken: string, now: Date): Promise<boolean>;
  heartbeat(
    workerId: string,
    runId: string,
    leaseToken: string,
    now: Date,
    leaseMs: number,
  ): Promise<boolean>;
  appendEvent(
    run: ConstructRun,
    kind: (typeof eventKinds)[number],
    detail: string,
    at?: Date,
  ): Promise<ConstructEvent>;
  finishRun(
    workerId: string,
    runId: string,
    leaseToken: string,
    status: (typeof terminalStatuses)[number],
    result: RunResult,
    now: Date,
  ): Promise<ConstructRun>;
  recoverTimeouts(now: Date): Promise<ConstructRun[]>;
};

function at(now?: Date) {
  return (now ?? new Date()).toISOString();
}

export class MemoryConstructStore implements ConstructStore {
  sources = new Map<string, SourceSnapshot>();
  briefs = new Map<string, ConstructBrief>();
  runs = new Map<string, ConstructRun>();
  events: ConstructEvent[] = [];

  async importSource(source: SourceSnapshot) {
    const existing = this.sources.get(source.id);
    if (existing) {
      if (existing.person_id !== source.person_id || existing.tree_hash !== source.tree_hash)
        throw new ConstructStoreError('Source snapshot replay does not match.');
      return existing;
    }
    this.sources.set(source.id, source);
    return source;
  }

  async readSource(personId: string, sourceId: string) {
    const source = this.sources.get(sourceId);
    return source?.person_id === personId ? source : null;
  }

  async approveBrief(personId: string, briefId: string, scope: ConstructBrief['scope']) {
    const existing = this.briefs.get(briefId);
    const hash = approvalHash(scope);
    if (existing) {
      if (existing.person_id !== personId || existing.approval_hash !== hash)
        throw new ConstructStoreError('Brief replay does not match the approved scope.');
      return existing;
    }
    const brief: ConstructBrief = {
      id: briefId,
      person_id: personId,
      approval_hash: hash,
      status: 'approved',
      invalidation_reason: null,
      scope,
      created_at: at(),
    };
    this.briefs.set(briefId, brief);
    return brief;
  }

  async readBrief(personId: string, briefId: string) {
    const brief = this.briefs.get(briefId);
    return brief?.person_id === personId ? brief : null;
  }

  async invalidateProjectBriefs(personId: string, projectId: string, reason: string) {
    let count = 0;
    for (const brief of this.briefs.values()) {
      if (brief.person_id === personId && brief.scope.project_id === projectId && brief.status === 'approved') {
        brief.status = 'invalidated';
        brief.invalidation_reason = reason;
        count++;
      }
    }
    return count;
  }

  async startRun(input: Parameters<ConstructStore['startRun']>[0]) {
    const existing = this.runs.get(input.requestId);
    if (existing) {
      if (
        existing.person_id !== input.personId ||
        existing.brief_id !== input.briefId ||
        existing.approval_hash !== input.approvalHash ||
        existing.project_revision !== input.expected
      )
        throw new ConstructStoreError('Request already reserved with a different brief or source pin.');
      return existing;
    }
    const run: ConstructRun = {
      id: input.requestId,
      person_id: input.personId,
      project_id: input.projectId,
      brief_id: input.briefId,
      approval_hash: input.approvalHash,
      source_id: input.sourceId,
      source_kind: input.sourceKind,
      source_tree_hash: input.sourceTreeHash,
      project_revision: input.expected,
      status: 'queued',
      cancel_requested: false,
      worker_id: null,
      lease_token: null,
      lease_until: null,
      result: null,
      created_at: at(),
      updated_at: at(),
    };
    this.runs.set(run.id, run);
    await this.appendEvent(run, 'queued', 'Run queued. The request handler does not execute software changes.');
    return run;
  }

  async readRun(personId: string, runId: string) {
    const run = this.runs.get(runId);
    return run?.person_id === personId ? run : null;
  }

  async listRuns(personId: string, projectId: string) {
    return [...this.runs.values()]
      .filter((run) => run.person_id === personId && run.project_id === projectId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 30);
  }

  async listEvents(personId: string, runId: string) {
    return this.events.filter((event) => event.person_id === personId && event.run_id === runId);
  }

  async cancelRun(personId: string, runId: string) {
    const run = this.runs.get(runId);
    if (!run || run.person_id !== personId) throw new ConstructStoreError('Run unavailable.', 'not_found');
    if (terminalStatuses.includes(run.status as (typeof terminalStatuses)[number])) return run;
    run.cancel_requested = true;
    if (run.status === 'queued') {
      run.status = 'cancelled';
      run.updated_at = at();
      await this.appendEvent(run, 'cancelled', 'Owner cancelled the queued run before a worker claimed it.');
    } else {
      run.updated_at = at();
      await this.appendEvent(run, 'cancelled', 'Owner requested cancellation. The worker will clean up the lease.');
    }
    return run;
  }

  async claimRun(workerId: string, now: Date, leaseMs = 45000) {
    const current = now.toISOString();
    const queued = [...this.runs.values()]
      .filter(
        (run) =>
          run.status === 'queued' ||
          ((run.status === 'claimed' || run.status === 'running') &&
            run.lease_until &&
            run.lease_until < current &&
            !run.cancel_requested),
      )
      .sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
    if (!queued) return null;
    const recovered = queued.status !== 'queued';
    queued.status = 'claimed';
    queued.worker_id = workerId;
    queued.lease_token = randomUUID();
    queued.lease_until = new Date(now.getTime() + leaseMs).toISOString();
    queued.updated_at = current;
    await this.appendEvent(
      queued,
      recovered ? 'lease_recovered' : 'claimed',
      recovered ? `Lease recovered by ${workerId}.` : `Claimed by ${workerId}.`,
      now,
    );
    return queued;
  }

  owns(run: ConstructRun | undefined, workerId: string, leaseToken: string) {
    return Boolean(run && run.worker_id === workerId && run.lease_token === leaseToken);
  }

  /** Token fencing plus unexpired lease. An expired or cleared claim cannot act merely because no replacement arrived. */
  ownsFresh(run: ConstructRun | undefined, workerId: string, leaseToken: string, now: Date) {
    if (!this.owns(run, workerId, leaseToken) || !run) return false;
    return Boolean(run.lease_until && run.lease_until > now.toISOString());
  }

  async markRunning(workerId: string, runId: string, leaseToken: string, now: Date) {
    const run = this.runs.get(runId);
    if (!this.owns(run, workerId, leaseToken) || !run) return false;
    if (terminalStatuses.includes(run.status as (typeof terminalStatuses)[number])) return true;
    if (!this.ownsFresh(run, workerId, leaseToken, now)) return false;
    run.status = 'running';
    run.updated_at = now.toISOString();
    return true;
  }

  async heartbeat(workerId: string, runId: string, leaseToken: string, now: Date, leaseMs: number) {
    const run = this.runs.get(runId);
    if (!this.ownsFresh(run, workerId, leaseToken, now) || !run) return false;
    if (run.status !== 'claimed' && run.status !== 'running') return false;
    run.lease_until = new Date(now.getTime() + leaseMs).toISOString();
    run.updated_at = now.toISOString();
    return true;
  }

  async appendEvent(run: ConstructRun, kind: (typeof eventKinds)[number], detail: string, when?: Date) {
    if (run.worker_id && run.lease_token) {
      const current = this.runs.get(run.id);
      if (!this.ownsFresh(current, run.worker_id, run.lease_token, when ?? new Date()))
        throw new ConstructStoreError('Run is not claimed by this worker lease.');
    }
    const seq = this.events.filter((event) => event.run_id === run.id).length + 1;
    const event: ConstructEvent = {
      id: randomUUID(),
      run_id: run.id,
      person_id: run.person_id,
      seq,
      kind,
      detail,
      created_at: at(when),
    };
    this.events.push(event);
    return event;
  }

  async finishRun(
    workerId: string,
    runId: string,
    leaseToken: string,
    status: (typeof terminalStatuses)[number],
    result: RunResult,
    now: Date,
  ) {
    const run = this.runs.get(runId);
    if (!this.owns(run, workerId, leaseToken) || !run)
      throw new ConstructStoreError('Run is not claimed by this worker lease.');
    if (terminalStatuses.includes(run.status as (typeof terminalStatuses)[number])) return run;
    if (!this.ownsFresh(run, workerId, leaseToken, now))
      throw new ConstructStoreError('Run is not claimed by this worker lease.');
    if (serializedReceiptBytes(result) > RESULT_RECEIPT_MAX_BYTES)
      throw new ConstructStoreError(
        'Durable result exceeds the 120000-byte receipt limit.',
        'too-large',
      );
    const kind =
      status === 'timed_out'
        ? 'timed_out'
        : status === 'blocked'
          ? 'blocked'
          : status === 'cancelled'
            ? 'cancelled'
            : 'finished';
    await this.appendEvent(run, kind, status, now);
    run.status = status;
    run.result = result;
    run.lease_until = null;
    run.updated_at = now.toISOString();
    return run;
  }

  async recoverTimeouts(now: Date) {
    const current = now.toISOString();
    const recovered: ConstructRun[] = [];
    for (const run of this.runs.values()) {
      if (
        (run.status === 'claimed' || run.status === 'running') &&
        run.lease_until &&
        run.lease_until < current &&
        run.cancel_requested
      ) {
        run.status = 'cancelled';
        run.result = run.result ?? {
          isolation: 'unavailable',
          runtime_available: false,
          sandbox: false,
          blocker: 'Owner cancelled the run and the worker lease expired.',
          source_hash: run.source_tree_hash,
          result_hash: null,
          changed_files: [],
          diff: '',
          checks: [],
          preview: {
            path: null,
            body: '',
            unavailable_reason: 'Cancelled before preview collection.',
          },
          artifacts: [],
        };
        run.updated_at = current;
        const seq = this.events.filter((event) => event.run_id === run.id).length + 1;
        this.events.push({
          id: randomUUID(),
          run_id: run.id,
          person_id: run.person_id,
          seq,
          kind: 'cancelled',
          detail: 'Cancelled after the worker lease expired.',
          created_at: current,
        });
        run.lease_until = null;
        recovered.push(run);
      }
    }
    return recovered;
  }
}
