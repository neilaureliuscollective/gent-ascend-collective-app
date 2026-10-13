import { executeConstruct } from './runner';
import { sanitizeLog } from './sanitize';
import { type ConstructRun, type RunResult, terminalStatuses } from './schema';
import type { ConstructStore } from './store';

export async function processConstructOnce(store: ConstructStore, workerId: string, now = new Date()) {
  await store.recoverTimeouts(now);
  const claimed = await store.claimRun(workerId, now);
  if (!claimed) return null;
  if (claimed.cancel_requested) {
    return store.finishRun(
      workerId,
      claimed.id,
      'cancelled',
      emptyResult(claimed, 'Owner cancelled the run before execution started.'),
      now,
    );
  }
  await store.markRunning(workerId, claimed.id, now);
  await store.appendEvent(claimed, 'started', 'Worker started isolated execution.');
  await store.heartbeat(workerId, claimed.id, now, 45000);
  const brief = await store.readBrief(claimed.person_id, claimed.brief_id);
  const source = await store.readSource(claimed.person_id, claimed.source_id);
  if (!brief || brief.status !== 'approved' || !source) {
    const result = emptyResult(
      claimed,
      'Approved brief or source snapshot is missing. Execution was blocked without inventing files.',
    );
    await store.appendEvent(claimed, 'blocked', result.blocker ?? 'Blocked.');
    return store.finishRun(workerId, claimed.id, 'blocked', result, now);
  }
  if (
    brief.approval_hash !== claimed.approval_hash ||
    source.tree_hash !== claimed.source_tree_hash ||
    brief.scope.project_revision !== claimed.project_revision
  ) {
    const result = emptyResult(claimed, 'Source pin or brief scope changed after approval.');
    await store.appendEvent(claimed, 'blocked', result.blocker ?? 'Blocked.');
    return store.finishRun(workerId, claimed.id, 'blocked', result, now);
  }
  if (claimed.cancel_requested)
    return store.finishRun(
      workerId,
      claimed.id,
      'cancelled',
      emptyResult(claimed, 'Owner cancelled the run after claim.'),
      now,
    );
  try {
    await store.appendEvent(claimed, 'source_prepared', sanitizeLog(source.label));
    const executed = await executeConstruct({
      source,
      scope: brief.scope,
      previewPath: brief.scope.allowed_paths.find((path) => path.endsWith('.html')),
    });
    const latest = await store.readRun(claimed.person_id, claimed.id);
    if (latest?.cancel_requested)
      return store.finishRun(
        workerId,
        claimed.id,
        'cancelled',
        { ...executed, blocker: executed.blocker ?? 'Cancelled after execution work started.' },
        now,
      );
    if (executed.changed_files.length) await store.appendEvent(claimed, 'patch_applied', executed.changed_files.join(','));
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
    return store.finishRun(workerId, claimed.id, status, executed, now);
  } catch (error) {
    const result = emptyResult(
      claimed,
      sanitizeLog(error instanceof Error ? error.message : 'Execution crashed before a durable result.'),
    );
    return store.finishRun(workerId, claimed.id, 'failed', result, now);
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
