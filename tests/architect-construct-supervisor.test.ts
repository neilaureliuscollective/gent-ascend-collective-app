import { expect, it } from 'vitest';
import { fixtureScope, fixtureSource } from '@/domains/architect-construct/fixture';
import { MemoryConstructStore } from '@/domains/architect-construct/store';
import {
  superviseConstructWorker,
  supervisorBackoff,
} from '@/domains/architect-construct/supervisor';
import { resultFenceEnd, resultFenceStart } from '@/domains/architect-construct/docker';

const owner = '00000000-0000-4000-8000-000000000001';
const project = '00000000-0000-4000-8000-000000000003';

async function queue(store: MemoryConstructStore, requestId: string) {
  const source = fixtureSource(owner, requestId);
  const scope = fixtureScope({
    projectId: project,
    projectRevision: 1,
    sourceId: source.id,
    sourceTreeHash: source.tree_hash,
  });
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

it('backs off after failures and stays within the documented ceiling', () => {
  expect(supervisorBackoff(1500, 0, 15000)).toBe(1500);
  expect(supervisorBackoff(1500, 2, 15000)).toBe(6000);
  expect(supervisorBackoff(1500, 8, 15000)).toBe(15000);
});

it('shuts down the supervised loop on abort after idle ticks', async () => {
  const store = new MemoryConstructStore();
  const shutdown = new AbortController();
  const ticks: Array<string | null> = [];
  const running = superviseConstructWorker({
    store,
    workerId: 'supervisor-idle',
    signal: shutdown.signal,
    idleMs: 20,
    sleep: async (ms, signal) => {
      if (ticks.length >= 2) shutdown.abort();
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, ms);
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          resolve();
        });
      });
    },
    onTick: (run) => ticks.push(run?.id ?? null),
  });
  const result = await running;
  expect(result.ticks).toBeGreaterThanOrEqual(2);
  expect(ticks.every((id) => id === null)).toBe(true);
});

it('recovers a queued run then stops when cancelled during work', async () => {
  const store = new MemoryConstructStore();
  const requestId = '00000000-0000-4000-8000-000000000091';
  const { source, scope } = await queue(store, requestId);
  const shutdown = new AbortController();
  let started = false;
  const running = superviseConstructWorker({
    store,
    workerId: 'supervisor-cancel',
    signal: shutdown.signal,
    idleMs: 10,
    execute: {
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
        started = true;
        await store.cancelRun(owner, requestId);
        return {
          exit_code: 0,
          stdout: `${resultFenceStart}\n${JSON.stringify({
            checks: [
              { name: 'syntax', command: 'node --check check.mjs', exit_code: 0, status: 'passed', log: '' },
              { name: 'heading', command: 'node check.mjs', exit_code: 0, status: 'passed', log: '' },
            ],
            files: source.files.map((file) =>
              file.path === 'preview.html' ? { ...file, content: scope.patch[0]!.after } : file,
            ),
            preview: { path: 'preview.html', body: scope.patch[0]!.after, unavailable_reason: null },
          })}\n${resultFenceEnd}\n`,
          stderr: '',
        };
      },
    },
    onTick: (run) => {
      if (run) shutdown.abort();
    },
  });
  const result = await running;
  expect(started).toBe(true);
  expect(result.ticks).toBeGreaterThanOrEqual(1);
  const saved = await store.readRun(owner, requestId);
  expect(saved?.status).toBe('cancelled');
});
