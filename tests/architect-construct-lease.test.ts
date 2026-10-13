import { expect, it } from 'vitest';
import { fixtureScope, fixtureSource } from '@/domains/architect-construct/fixture';
import { resultFenceEnd, resultFenceStart } from '@/domains/architect-construct/docker';
import { MemoryConstructStore } from '@/domains/architect-construct/store';
import { processConstructOnce } from '@/domains/architect-construct/worker';

const owner = '00000000-0000-4000-8000-000000000001';
const project = '00000000-0000-4000-8000-000000000003';

function payloadFor(source: ReturnType<typeof fixtureSource>, after: string) {
  return {
    checks: [
      { name: 'syntax', command: 'node --check check.mjs', exit_code: 0, status: 'passed', log: '' },
      { name: 'heading', command: 'node check.mjs', exit_code: 0, status: 'passed', log: '' },
    ],
    files: source.files.map((file) => (file.path === 'preview.html' ? { ...file, content: after } : file)),
    preview: { path: 'preview.html', body: after, unavailable_reason: null },
  };
}

async function queued(store: MemoryConstructStore, requestId: string, leaseMs = 45000) {
  const source = fixtureSource(owner, requestId);
  const scope = fixtureScope({
    projectId: project,
    projectRevision: 1,
    sourceId: source.id,
    sourceTreeHash: source.tree_hash,
  });
  scope.resource_limits = { ...scope.resource_limits, lease_ms: leaseMs };
  await store.importSource(source);
  const brief = await store.approveBrief(owner, requestId, scope);
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
  return { source, scope };
}

it('renews a lease for a job longer than one lease window', async () => {
  const store = new MemoryConstructStore();
  const requestId = '00000000-0000-4000-8000-000000000081';
  const { source, scope } = await queued(store, requestId, 5000);
  const started = Date.now();
  const executed = await processConstructOnce(store, 'long-worker', new Date(), {
    probe: async () => ({
      available: true,
      backend: 'docker',
      version: '27.0.0',
      image: 'node:24-alpine',
      code: 'available',
      reason: null,
    }),
    ensureImage: async () => ({ ready: true, reason: null, pulled: false }),
    launchContainer: async () => {
      await new Promise((resolve) => setTimeout(resolve, 5500));
      return {
        exit_code: 0,
        stdout: `${resultFenceStart}\n${JSON.stringify(payloadFor(source, scope.patch[0]!.after))}\n${resultFenceEnd}\n`,
        stderr: '',
      };
    },
  });
  expect(Date.now() - started).toBeGreaterThan(5000);
  expect(executed?.status).toBe('succeeded');
  expect(executed?.result?.sandbox).toBe(true);
});

it('lets only one of two competing workers finish a claim', async () => {
  const store = new MemoryConstructStore();
  const requestId = '00000000-0000-4000-8000-000000000082';
  const { source, scope } = await queued(store, requestId);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const first = processConstructOnce(store, 'worker-a', new Date(), {
    probe: async () => ({
      available: true,
      backend: 'docker',
      version: '27.0.0',
      image: 'node:24-alpine',
      code: 'available',
      reason: null,
    }),
    ensureImage: async () => ({ ready: true, reason: null, pulled: false }),
    launchContainer: async () => {
      release();
      await new Promise((resolve) => setTimeout(resolve, 50));
      return {
        exit_code: 0,
        stdout: `${resultFenceStart}\n${JSON.stringify(payloadFor(source, scope.patch[0]!.after))}\n${resultFenceEnd}\n`,
        stderr: '',
      };
    },
  });
  await gate;
  expect(await processConstructOnce(store, 'worker-b')).toBeNull();
  expect((await first)?.status).toBe('succeeded');
});

it('rejects stale completion after crash takeover', async () => {
  const store = new MemoryConstructStore();
  const requestId = '00000000-0000-4000-8000-000000000083';
  const { source, scope } = await queued(store, requestId);
  const first = await store.claimRun('dead-worker', new Date());
  const staleToken = first!.lease_token!;
  first!.lease_until = new Date(Date.now() - 1000).toISOString();
  const taken = await processConstructOnce(store, 'worker-b', new Date(), {
    probe: async () => ({
      available: true,
      backend: 'docker',
      version: '27.0.0',
      image: 'node:24-alpine',
      code: 'available',
      reason: null,
    }),
    ensureImage: async () => ({ ready: true, reason: null, pulled: false }),
    launchContainer: async () => ({
      exit_code: 0,
      stdout: `${resultFenceStart}\n${JSON.stringify(payloadFor(source, scope.patch[0]!.after))}\n${resultFenceEnd}\n`,
      stderr: '',
    }),
  });
  expect(taken?.status).toBe('succeeded');
  await expect(
    store.finishRun('dead-worker', requestId, staleToken, 'succeeded', taken!.result!, new Date()),
  ).rejects.toThrow(/lease/i);
  const reloaded = await store.readRun(owner, requestId);
  expect(reloaded?.status).toBe('succeeded');
  expect(reloaded?.worker_id).toContain('worker-b');
});
