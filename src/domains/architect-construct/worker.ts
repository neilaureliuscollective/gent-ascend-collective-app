import { executeConstruct, teardownConfirmed, type ExecuteOptions } from './runner';
import { sanitizeLog } from './sanitize';
import { defaultLimits, type ConstructRun, type RunResult, terminalStatuses } from './schema';
import { ConstructStoreError, type ConstructStore } from './store';

export class LeaseLostError extends Error {
  constructor(message = 'Worker lost the lease before a durable result was recorded.') {
    super(message);
  }
}

export function constructWorkerIdentity(env: NodeJS.ProcessEnv = process.env) {
  const named = env.ARCHITECT_CONSTRUCT_WORKER_ID?.trim() || 'construct-worker';
  return `${named}-${process.pid}`;
}

export async function processConstructOnce(
  store: ConstructStore,
  workerId: string,
  now = new Date(),
  options: ExecuteOptions = {},
) {
  await store.recoverTimeouts(now);
  const claimed = await store.claimRun(workerId, now);
  if (!claimed) return null;
  const token = claimed.lease_token;
  if (!token) throw new ConstructStoreError('Claim did not issue a lease token.');
  const finish = (
    status: (typeof terminalStatuses)[number],
    result: RunResult,
    when = new Date(),
  ) => store.finishRun(workerId, claimed.id, token, status, result, when);
  if (claimed.cancel_requested) {
    return finish('cancelled', emptyResult(claimed, 'Owner cancelled the run before execution started.'), now);
  }
  if (!(await store.markRunning(workerId, claimed.id, token, now)))
    throw new LeaseLostError('Worker lost the lease before the run could start.');
  await store.appendEvent(claimed, 'started', 'Worker started isolated execution.');
  let leaseMs = defaultLimits.lease_ms;
  let lost = false;
  const renew = async () => {
    try {
      const ok = await store.heartbeat(workerId, claimed.id, token, new Date(), leaseMs);
      if (!ok) lost = true;
      return ok;
    } catch {
      lost = true;
      return false;
    }
  };
  if (!(await renew())) throw new LeaseLostError();
  let interval = setInterval(() => {
    void renew();
  }, Math.max(1000, Math.floor(leaseMs / 3)));
  const setLeaseWindow = (ms: number) => {
    leaseMs = ms;
    clearInterval(interval);
    interval = setInterval(() => {
      void renew();
    }, Math.max(1000, Math.floor(leaseMs / 3)));
  };
  try {
    const brief = await store.readBrief(claimed.person_id, claimed.brief_id);
    const source = await store.readSource(claimed.person_id, claimed.source_id);
    if (!brief || brief.status !== 'approved' || !source) {
      const result = emptyResult(
        claimed,
        'Approved brief or source snapshot is missing. Execution was blocked without inventing files.',
      );
      await store.appendEvent(claimed, 'blocked', result.blocker ?? 'Blocked.');
      return finish('blocked', result, now);
    }
    setLeaseWindow(brief.scope.resource_limits.lease_ms);
    if (!(await renew())) throw new LeaseLostError();
    if (
      brief.approval_hash !== claimed.approval_hash ||
      source.tree_hash !== claimed.source_tree_hash ||
      brief.scope.project_revision !== claimed.project_revision
    ) {
      const result = emptyResult(claimed, 'Source pin or brief scope changed after approval.');
      await store.appendEvent(claimed, 'blocked', result.blocker ?? 'Blocked.');
      return finish('blocked', result, now);
    }
    const latest = await store.readRun(claimed.person_id, claimed.id);
    if (latest?.cancel_requested)
      return finish('cancelled', emptyResult(claimed, 'Owner cancelled the run after claim.'), now);
    await store.appendEvent(claimed, 'source_prepared', sanitizeLog(source.label));
    let cancelSeen = false;
    let cancelUncertain = false;
    let polling = false;
    let pollGate: Promise<void> = Promise.resolve();
    const watchCancel = setInterval(() => {
      if (polling) return;
      polling = true;
      pollGate = store
        .readRun(claimed.person_id, claimed.id)
        .then((current) => {
          if (current?.cancel_requested) cancelSeen = true;
        })
        .catch(() => {
          cancelUncertain = true;
        })
        .finally(() => {
          polling = false;
        });
    }, 400);
    let executed;
    try {
      executed = await executeConstruct(
        {
          source,
          scope: brief.scope,
          previewPath: brief.scope.allowed_paths.find((path) => path.endsWith('.html')),
        },
        {
          ...options,
          requireIsolation: true,
          trustedInProcess: undefined,
          shouldAbort: () =>
            lost || cancelSeen || cancelUncertain || Boolean(options.shouldAbort?.()),
        },
      );
    } finally {
      clearInterval(watchCancel);
      await pollGate;
    }
    if (lost) throw new LeaseLostError();
    if (!(await renew())) throw new LeaseLostError();
    let after;
    try {
      after = await store.readRun(claimed.person_id, claimed.id);
    } catch {
      cancelUncertain = true;
    }
    const wantsStop = Boolean(after?.cancel_requested || cancelSeen || options.shouldAbort?.());
    if (!teardownConfirmed(executed)) {
      if (lost) throw new LeaseLostError();
      return finish(
        'failed',
        {
          ...executed,
          sandbox: false,
          blocker:
            'Isolated teardown was not confirmed. The run is not reported cancelled or successfully stopped.',
        },
        new Date(),
      );
    }
    if (wantsStop || cancelUncertain) {
      if (cancelUncertain && !wantsStop)
        return finish(
          'failed',
          {
            ...executed,
            sandbox: false,
            blocker:
              'Cancellation poll was uncertain. Isolated execution was stopped fail-closed.',
          },
          new Date(),
        );
      return finish(
        'cancelled',
        {
          ...executed,
          sandbox: false,
          blocker:
            after?.cancel_requested || cancelSeen
              ? 'Owner cancelled the run while isolated execution was in progress.'
              : 'Worker shutdown cancelled isolated execution.',
        },
        new Date(),
      );
    }
    if (executed.changed_files.length)
      await store.appendEvent(claimed, 'patch_applied', executed.changed_files.join(','));
    for (const check of executed.checks) {
      await store.appendEvent(claimed, 'check_started', check.name);
      await store.appendEvent(claimed, 'check_finished', `${check.name}:${check.status}:${check.exit_code}`);
    }
    await store.appendEvent(
      claimed,
      'preview_collected',
      executed.preview.unavailable_reason ?? executed.preview.path ?? 'preview',
    );
    const status = executed.blocker
      ? 'blocked'
      : executed.checks.some((check) => check.status === 'failed')
        ? 'failed'
        : executed.checks.some((check) => check.status === 'blocked' || check.status === 'not-run')
          ? 'blocked'
          : 'succeeded';
    if (status === 'blocked') await store.appendEvent(claimed, 'blocked', executed.blocker ?? 'Checks did not complete.');
    return finish(status, executed, new Date());
  } catch (error) {
    if (error instanceof LeaseLostError || (error instanceof ConstructStoreError && /lease/i.test(error.message)))
      return null;
    const result = emptyResult(
      claimed,
      sanitizeLog(error instanceof Error ? error.message : 'Execution crashed before a durable result.'),
    );
    try {
      return await finish('failed', result, new Date());
    } catch {
      return null;
    }
  } finally {
    clearInterval(interval);
  }
}

function emptyResult(run: ConstructRun, blocker: string): RunResult {
  return {
    isolation: 'unavailable',
    runtime_available: false,
    sandbox: false,
    blocker,
    source_hash: run.source_tree_hash,
    result_hash: null,
    changed_files: [],
    diff: '',
    checks: [],
    preview: { path: null, body: '', unavailable_reason: blocker },
    artifacts: [],
  };
}

export function isTerminal(run: ConstructRun) {
  return terminalStatuses.includes(run.status as (typeof terminalStatuses)[number]);
}
