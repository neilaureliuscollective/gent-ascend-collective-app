import { expect, it } from 'vitest';
import { fixtureScope, fixtureSource } from '@/domains/architect-construct/fixture';
import { MemoryConstructStore } from '@/domains/architect-construct/store';
import { processConstructOnce } from '@/domains/architect-construct/worker';
import { defaultLimits } from '@/domains/architect-construct/schema';
import { labeledSource, treeHash } from '@/domains/architect-construct/hash';

const owner = '00000000-0000-4000-8000-000000000001';
const project = '00000000-0000-4000-8000-000000000003';

async function queuedFixture(store: MemoryConstructStore, requestId: string) {
  const source = fixtureSource(owner, requestId);
  await store.importSource(source);
  const brief = await store.approveBrief(
    owner,
    requestId,
    fixtureScope({
      projectId: project,
      projectRevision: 1,
      sourceId: source.id,
      sourceTreeHash: source.tree_hash,
    }),
  );
  return store.startRun({
    personId: owner,
    projectId: project,
    briefId: brief.id,
    requestId,
    expected: 1,
    sourceKind: source.kind,
    sourceTreeHash: source.tree_hash,
    approvalHash: brief.approval_hash,
    sourceId: source.id,
  });
}

it('executes one claimed fixture and recovers the same result on reload', async () => {
  const store = new MemoryConstructStore();
  const requestId = '00000000-0000-4000-8000-000000000031';
  await queuedFixture(store, requestId);
  const first = await processConstructOnce(store, 'worker-a');
  expect(first?.status).toBe('succeeded');
  expect(first?.result?.checks.every((check) => check.status === 'passed')).toBe(true);
  expect(first?.result?.preview.body).toContain('<h1>After</h1>');
  expect(await processConstructOnce(store, 'worker-a')).toBeNull();
  const reloaded = await store.readRun(owner, requestId);
  expect(reloaded?.result?.diff).toBe(first?.result?.diff);
  expect(reloaded?.result?.sandbox).toBe(false);
});

it('does not let a client-supplied successful result survive claim', async () => {
  const store = new MemoryConstructStore();
  const requestId = '00000000-0000-4000-8000-000000000032';
  const run = await queuedFixture(store, requestId);
  run.result = {
    isolation: 'docker',
    sandbox: true,
    blocker: null,
    source_hash: run.source_tree_hash,
    result_hash: run.source_tree_hash,
    changed_files: ['preview.html'],
    diff: 'forged',
    checks: [{ name: 'heading', command: 'true', exit_code: 0, status: 'passed', log: 'forged' }],
    preview: { path: 'preview.html', body: 'forged', unavailable_reason: null },
    artifacts: [],
  };
  const executed = await processConstructOnce(store, 'worker-a');
  expect(executed?.result?.diff).not.toBe('forged');
  expect(executed?.result?.sandbox).toBe(false);
  expect(executed?.result?.preview.body).toContain('<h1>After</h1>');
});

it('cancels a queued run and times out an expired lease without replay', async () => {
  const store = new MemoryConstructStore();
  const requestId = '00000000-0000-4000-8000-000000000033';
  await queuedFixture(store, requestId);
  const cancelled = await store.cancelRun(owner, requestId);
  expect(cancelled.status).toBe('cancelled');
  expect(await processConstructOnce(store, 'worker-a')).toBeNull();
  const staleId = '00000000-0000-4000-8000-000000000034';
  const stale = await queuedFixture(store, staleId);
  stale.status = 'running';
  stale.worker_id = 'dead-worker';
  stale.lease_until = new Date(Date.now() - 1000).toISOString();
  const timed = await store.recoverTimeouts(new Date());
  expect(timed[0]?.id).toBe(staleId);
  expect(timed[0]?.status).toBe('timed_out');
  expect(await processConstructOnce(store, 'worker-b')).toBeNull();
});

it('blocks imported source without a sandbox and does not claim success', async () => {
  const store = new MemoryConstructStore();
  const requestId = '00000000-0000-4000-8000-000000000035';
  const source = {
    ...fixtureSource(owner, requestId),
    kind: 'imported' as const,
    files: [],
    tree_hash: treeHash([]),
    label: labeledSource('imported', 'neilaureliuscollective/gent-ascend-collective-app', null),
  };
  await store.importSource(source);
  const brief = await store.approveBrief(owner, requestId, {
    project_id: project,
    project_revision: 1,
    source_id: source.id,
    repository: source.repository,
    source_commit: null,
    source_tree_hash: source.tree_hash,
    allowed_paths: ['preview.html'],
    protected_paths: ['.env'],
    intended_change: 'Imported empty tree must block.',
    acceptance_checks: [{ name: 'noop', command: 'true', args: [] }],
    resource_limits: defaultLimits,
    patch: [{ path: 'preview.html', before: 'a', after: 'b' }],
  });
  await store.startRun({
    personId: owner,
    projectId: project,
    briefId: brief.id,
    requestId,
    expected: 1,
    sourceKind: source.kind,
    sourceTreeHash: source.tree_hash,
    approvalHash: brief.approval_hash,
    sourceId: source.id,
  });
  const executed = await processConstructOnce(store, 'worker-a');
  expect(executed?.status).toBe('blocked');
  expect(executed?.result?.sandbox).toBe(false);
  expect(executed?.result?.blocker).toMatch(/Docker is not installed|no files|Missing source/i);
});
