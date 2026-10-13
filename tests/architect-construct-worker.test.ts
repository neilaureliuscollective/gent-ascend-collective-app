import { expect, it } from 'vitest';
import { fixtureScope, fixtureSource } from '@/domains/architect-construct/fixture';
import { MemoryConstructStore } from '@/domains/architect-construct/store';
import { processConstructOnce } from '@/domains/architect-construct/worker';
import { defaultLimits } from '@/domains/architect-construct/schema';
import { labeledSource, treeHash } from '@/domains/architect-construct/hash';
import { resultFenceEnd, resultFenceStart } from '@/domains/architect-construct/docker';

const owner = '00000000-0000-4000-8000-000000000001';
const project = '00000000-0000-4000-8000-000000000003';

function isolatedSuccess(source: ReturnType<typeof fixtureSource>, scope: ReturnType<typeof fixtureScope>) {
  const after = scope.patch[0]!.after;
  const files = source.files.map((file) =>
    file.path === 'preview.html' ? { ...file, content: after } : file,
  );
  return {
    probe: async () =>
      ({
        available: true as const,
        backend: 'docker' as const,
        version: '27.0.0',
        image: 'node:24-alpine',
        code: 'available' as const,
        reason: null,
      }),
    ensureImage: async () => ({ ready: true, reason: null, pulled: false }),
    launchContainer: async () => ({
      exit_code: 0,
      stdout: `${resultFenceStart}\n${JSON.stringify({
        checks: [
          { name: 'syntax', command: 'node --check check.mjs', exit_code: 0, status: 'passed', log: '' },
          { name: 'heading', command: 'node check.mjs', exit_code: 0, status: 'passed', log: '' },
        ],
        files,
        preview: { path: 'preview.html', body: after, unavailable_reason: null },
      })}\n${resultFenceEnd}\n`,
      stderr: '',
    }),
  };
}

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

it('executes one claimed fixture through isolation and recovers the same result on reload', async () => {
  const store = new MemoryConstructStore();
  const requestId = '00000000-0000-4000-8000-000000000031';
  const source = fixtureSource(owner, requestId);
  await queuedFixture(store, requestId);
  const first = await processConstructOnce(
    store,
    'worker-a',
    new Date(),
    isolatedSuccess(
      source,
      fixtureScope({
        projectId: project,
        projectRevision: 1,
        sourceId: source.id,
        sourceTreeHash: source.tree_hash,
      }),
    ),
  );
  expect(first?.status).toBe('succeeded');
  expect(first?.result?.isolation).toBe('docker');
  expect(first?.result?.sandbox).toBe(true);
  expect(first?.result?.checks.every((check) => check.status === 'passed')).toBe(true);
  expect(first?.result?.preview.body).toContain('<h1>After</h1>');
  expect(first?.lease_until).toBeNull();
  expect((await store.listEvents(owner, requestId)).map((event) => event.kind)).toContain('finished');
  expect(await processConstructOnce(store, 'worker-a')).toBeNull();
  const reloaded = await store.readRun(owner, requestId);
  expect(reloaded?.result?.diff).toBe(first?.result?.diff);
  expect(reloaded?.result?.sandbox).toBe(true);
});

it('does not let a client-supplied successful result survive claim', async () => {
  const store = new MemoryConstructStore();
  const requestId = '00000000-0000-4000-8000-000000000032';
  const source = fixtureSource(owner, requestId);
  const run = await queuedFixture(store, requestId);
  run.result = {
    isolation: 'docker',
    runtime_available: true,
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
  const executed = await processConstructOnce(
    store,
    'worker-a',
    new Date(),
    isolatedSuccess(
      source,
      fixtureScope({
        projectId: project,
        projectRevision: 1,
        sourceId: source.id,
        sourceTreeHash: source.tree_hash,
      }),
    ),
  );
  expect(executed?.result?.diff).not.toBe('forged');
  expect(executed?.result?.preview.body).toContain('<h1>After</h1>');
});

it('cancels a queued run and does not replay a cancelled expired lease', async () => {
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
  stale.lease_token = '00000000-0000-4000-8000-000000000099';
  stale.cancel_requested = true;
  stale.lease_until = new Date(Date.now() - 1000).toISOString();
  const recovered = await store.recoverTimeouts(new Date());
  expect(recovered[0]?.id).toBe(staleId);
  expect(recovered[0]?.status).toBe('cancelled');
  expect(await processConstructOnce(store, 'worker-b')).toBeNull();
});

it('cancels an isolated job after work starts and persists cancelled', async () => {
  const store = new MemoryConstructStore();
  const requestId = '00000000-0000-4000-8000-000000000036';
  const source = fixtureSource(owner, requestId);
  await queuedFixture(store, requestId);
  let launched = false;
  const executed = await processConstructOnce(store, 'cancel-active', new Date(), isolatedSuccess(source, fixtureScope({
    projectId: project,
    projectRevision: 1,
    sourceId: source.id,
    sourceTreeHash: source.tree_hash,
  })));
  expect(executed?.status).toBe('succeeded');
  const activeId = '00000000-0000-4000-8000-000000000037';
  const activeSource = fixtureSource(owner, activeId);
  await queuedFixture(store, activeId);
  const cancelled = await processConstructOnce(store, 'cancel-docker', new Date(), {
    ...isolatedSuccess(
      activeSource,
      fixtureScope({
        projectId: project,
        projectRevision: 1,
        sourceId: activeSource.id,
        sourceTreeHash: activeSource.tree_hash,
      }),
    ),
    launchContainer: async (_args, _timeout, shouldAbort) => {
      launched = true;
      await store.cancelRun(owner, activeId);
      const started = Date.now();
      while (!shouldAbort?.()) {
        if (Date.now() - started > 2000) break;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(shouldAbort?.()).toBe(true);
      return { exit_code: 137, stdout: '', stderr: 'Isolated job cancelled.', stopped: true };
    },
  });
  expect(launched).toBe(true);
  expect(cancelled?.status).toBe('cancelled');
  expect(cancelled?.result?.sandbox).toBe(false);
  expect(cancelled?.result?.blocker).toMatch(/cancelled/i);
  const events = await store.listEvents(owner, activeId);
  expect(events.map((event) => event.kind)).toContain('cancelled');
});

it('treats supervisor shutdown as cancellation of the isolated job', async () => {
  const store = new MemoryConstructStore();
  const requestId = '00000000-0000-4000-8000-000000000038';
  await queuedFixture(store, requestId);
  const shutdown = { aborted: false };
  const executed = await processConstructOnce(store, 'shutdown-docker', new Date(), {
    probe: async () => ({
      available: true,
      backend: 'docker',
      version: '27.0.0',
      image: 'node:24-alpine',
      code: 'available',
      reason: null,
    }),
    ensureImage: async () => ({ ready: true, reason: null, pulled: false }),
    shouldAbort: () => shutdown.aborted,
    launchContainer: async (_args, _timeout, shouldAbort) => {
      shutdown.aborted = true;
      const started = Date.now();
      while (!shouldAbort?.()) {
        if (Date.now() - started > 2000) break;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      return { exit_code: 137, stdout: '', stderr: 'Isolated job cancelled.', stopped: true };
    },
  });
  expect(executed?.status).toBe('cancelled');
  expect(executed?.result?.blocker).toMatch(/shutdown|cancelled/i);
});

it('does not persist a result when the lease is lost during isolated execution', async () => {
  const store = new MemoryConstructStore();
  const requestId = '00000000-0000-4000-8000-000000000039';
  const source = fixtureSource(owner, requestId);
  const scope = fixtureScope({
    projectId: project,
    projectRevision: 1,
    sourceId: source.id,
    sourceTreeHash: source.tree_hash,
  });
  await queuedFixture(store, requestId);
  const brief = store.briefs.get(requestId);
  if (brief)
    brief.scope.resource_limits = { ...brief.scope.resource_limits, lease_ms: 5000 };
  let beats = 0;
  const heartbeat = store.heartbeat.bind(store);
  store.heartbeat = async (...args) => {
    beats += 1;
    if (beats > 2) return false;
    return heartbeat(...args);
  };
  const executed = await processConstructOnce(store, 'lost-docker', new Date(), {
    ...isolatedSuccess(source, scope),
    launchContainer: async (_args, _timeout, shouldAbort) => {
      const started = Date.now();
      while (!shouldAbort?.() && Date.now() - started < 4000) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(shouldAbort?.()).toBe(true);
      return {
        exit_code: 137,
        stdout: '',
        stderr: 'Isolated job cancelled.',
      };
    },
  });
  expect(executed).toBeNull();
  const reloaded = await store.readRun(owner, requestId);
  expect(reloaded?.result).toBeNull();
  expect(['claimed', 'running']).toContain(reloaded?.status);
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
  expect(executed?.result?.runtime_available).toBe(false);
  expect(executed?.result?.blocker).toMatch(/no files|Missing source/i);
});

it('treats a transient cancellation poll rejection as fail-closed and does not overlap reads', async () => {
  const store = new MemoryConstructStore();
  const requestId = '00000000-0000-4000-8000-000000000043';
  const source = fixtureSource(owner, requestId);
  await queuedFixture(store, requestId);
  let watch = false;
  let inflight = 0;
  let maxInflight = 0;
  const original = store.readRun.bind(store);
  store.readRun = async (...args) => {
    if (!watch) return original(...args);
    inflight += 1;
    maxInflight = Math.max(maxInflight, inflight);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      throw new Error('transient poll rejection');
    } finally {
      inflight -= 1;
    }
  };
  const executed = await processConstructOnce(store, 'poll-reject', new Date(), {
    ...isolatedSuccess(
      source,
      fixtureScope({
        projectId: project,
        projectRevision: 1,
        sourceId: source.id,
        sourceTreeHash: source.tree_hash,
      }),
    ),
    launchContainer: async (_args, _timeout, shouldAbort) => {
      watch = true;
      const started = Date.now();
      while (!shouldAbort?.() && Date.now() - started < 2000) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(shouldAbort?.()).toBe(true);
      return { exit_code: 137, stdout: '', stderr: 'Isolated job cancelled.', stopped: true };
    },
  });
  expect(maxInflight).toBe(1);
  expect(executed?.status).toBe('failed');
  expect(executed?.result?.sandbox).toBe(false);
  expect(executed?.result?.blocker).toMatch(/uncertain|fail-closed/i);
  expect(executed?.status).not.toBe('cancelled');
});

it('does not report cancelled when isolated teardown is unconfirmed', async () => {
  const store = new MemoryConstructStore();
  const requestId = '00000000-0000-4000-8000-000000000044';
  const source = fixtureSource(owner, requestId);
  await queuedFixture(store, requestId);
  const executed = await processConstructOnce(store, 'teardown-unconfirmed', new Date(), {
    ...isolatedSuccess(
      source,
      fixtureScope({
        projectId: project,
        projectRevision: 1,
        sourceId: source.id,
        sourceTreeHash: source.tree_hash,
      }),
    ),
    launchContainer: async (_args, _timeout, shouldAbort) => {
      await store.cancelRun(owner, requestId);
      const started = Date.now();
      while (!shouldAbort?.() && Date.now() - started < 2000) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      return { exit_code: 137, stdout: '', stderr: 'Isolated job cancelled.', stopped: false };
    },
  });
  expect(executed?.status).toBe('failed');
  expect(executed?.result?.blocker).toMatch(/teardown was not confirmed/i);
  const reloaded = await store.readRun(owner, requestId);
  expect(reloaded?.status).toBe('failed');
  expect(reloaded?.status).not.toBe('cancelled');
});
