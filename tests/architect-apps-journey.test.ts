import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({
  owner: '00000000-0000-4000-8000-000000000001',
  other: '00000000-0000-4000-8000-000000000002',
  projectId: '00000000-0000-4000-8000-000000000003',
  revision: 1,
}));
vi.mock('@/domains/intelligence/service', () => ({
  IntelligenceError: class extends Error {
    constructor(
      message: string,
      public status = 400,
    ) {
      super(message);
    }
  },
  intelligenceSession: async () => ({
    person: { id: state.owner },
    client: {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: state.projectId,
                  person_id: state.owner,
                  revision: state.revision,
                  content: { name: 'Notes', blueprint: { vision: 'Keep field notes.' } },
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    },
  }),
}));
import {
  approveArchitectApp,
  appStore,
  cancelArchitectApp,
  operateArchitectAppData,
  proposeArchitectApp,
  readArchitectApp,
  reopenArchitectApp,
  startArchitectApp,
} from '@/domains/architect-apps/service';
import { MemoryAppStore } from '@/domains/architect-apps/store';
import { acceptAppBuildSuccess, processAppBuildOnce } from '@/domains/architect-apps/worker';
import { mockedSupportedAppProposal } from '@/domains/architect-apps/provider';
import { signPreviewSession } from '@/domains/architect-apps/preview';
import { writeFile, mkdir } from 'node:fs/promises';

beforeEach(() => {
  vi.stubEnv('ARCHITECT_ORIGIN_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_APPS_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_APPS_STORE', 'memory');
  vi.stubEnv('ARCHITECT_APPS_AI_MOCK', 'true');
  vi.stubEnv('APP_ENV', 'local');
  const store = appStore() as MemoryAppStore;
  store.apps.clear();
  store.revisions.clear();
  store.artifacts.clear();
  store.jobs.clear();
  store.events.length = 0;
  store.records.clear();
  state.revision = 1;
});

const transport = async (input: { kind: 'create' | 'revise'; files: { path: string; content: string }[] }) =>
  mockedSupportedAppProposal(input);

function isolatedBuild(body = '<html><body><h1>Field notes</h1><p id="note">Site visit</p></body></html>') {
  return async () => ({
    result: {
      ok: true,
      isolation: 'docker' as const,
      sandbox: true,
      typecheck: { ok: true, log: 'ok' },
      bundle: { ok: true, log: 'ok' },
      blocker: null,
      stages: [
        { kind: 'typecheck' as const, at: new Date().toISOString(), detail: 'Isolated TypeScript noEmit passed.' },
        { kind: 'bundle' as const, at: new Date().toISOString(), detail: 'Isolated Vite production bundle passed.' },
      ],
    },
    artifacts: [{ path: 'index.html', content: body }],
    manifestHash: 'd'.repeat(64),
  });
}

it('runs the authenticated notes journey through the real adapter, isolated success, records, reopen and recovery', async () => {
  const proposed = await proposeArchitectApp(
    {
      action: 'propose',
      projectId: state.projectId,
      requestId: '00000000-0000-4000-8000-000000000501',
      expected: 1,
      instruction: 'Create field notes I can save.',
      kind: 'create',
      demo: 'none',
    },
    transport,
  );
  expect(proposed.generation.mode).toBe('mock');
  expect(proposed.proposal.files.length).toBeGreaterThan(6);
  const approved = await approveArchitectApp({
    action: 'approve',
    projectId: state.projectId,
    requestId: '00000000-0000-4000-8000-000000000502',
    expected: 1,
    approvalHash: proposed.approvalHash,
    proposal: proposed.proposal,
    generation: proposed.generation,
    baseRevision: null,
  });
  expect(approved.revision.status).toBe('approved');
  const recovered = await readArchitectApp(state.projectId);
  expect(recovered.pendingStart?.requestId).toBe(approved.revision.id);
  const started = await startArchitectApp({
    action: 'start',
    projectId: state.projectId,
    revisionId: approved.revision.id,
    requestId: approved.revision.id,
    expected: 1,
    approvalHash: approved.revision.approval_hash,
  });
  expect(started.id).toBe(approved.revision.id);
  const replayStart = await startArchitectApp({
    action: 'start',
    projectId: state.projectId,
    revisionId: approved.revision.id,
    requestId: approved.revision.id,
    expected: 1,
    approvalHash: approved.revision.approval_hash,
  });
  expect(replayStart.id).toBe(started.id);
  await processAppBuildOnce(appStore(), 'worker-a', new Date(), { build: isolatedBuild() });
  const ready = await readArchitectApp(state.projectId);
  expect(ready.current?.status).toBe('ready');
  expect(ready.preview?.srcDoc).toMatch(/Field notes/);
  expect(ready.preview?.revision).toBe(1);
  expect(ready.jobs[0]?.result?.isolation).toBe('docker');
  expect(ready.jobs[0]?.result?.sandbox).toBe(true);
  const session = signPreviewSession({
    personId: state.owner,
    projectId: state.projectId,
    revisionId: approved.revision.id,
  });
  const created = await operateArchitectAppData({
    projectId: state.projectId,
    revisionId: approved.revision.id,
    session,
    requestId: '00000000-0000-4000-8000-000000000531',
    operation: 'create',
    collection: 'notes',
    payload: { id: '00000000-0000-4000-8000-000000000541', title: 'Site visit', body: 'North wall', hours: 2 },
    idempotencyKey: '00000000-0000-4000-8000-000000000541',
  });
  const replay = await operateArchitectAppData({
    projectId: state.projectId,
    revisionId: approved.revision.id,
    session,
    requestId: '00000000-0000-4000-8000-000000000532',
    operation: 'create',
    collection: 'notes',
    payload: { id: '00000000-0000-4000-8000-000000000541', title: 'Changed', body: 'North wall', hours: 2 },
    idempotencyKey: '00000000-0000-4000-8000-000000000541',
  });
  expect((created.records[0] as { title?: string }).title).toBe('Site visit');
  expect(replay.records[0]?.id).toBe(created.records[0]?.id);
  await operateArchitectAppData({
    projectId: state.projectId,
    revisionId: approved.revision.id,
    session,
    requestId: '00000000-0000-4000-8000-000000000533',
    operation: 'update',
    collection: 'notes',
    payload: { id: '00000000-0000-4000-8000-000000000541', title: 'Site visit edited', body: 'North wall', hours: 3 },
  });
  const listed = await operateArchitectAppData({
    projectId: state.projectId,
    revisionId: approved.revision.id,
    session,
    requestId: '00000000-0000-4000-8000-000000000534',
    operation: 'list',
    collection: 'notes',
  });
  expect((listed.records[0] as { title?: string }).title).toBe('Site visit edited');
  const revised = await proposeArchitectApp(
    {
      action: 'propose',
      projectId: state.projectId,
      requestId: '00000000-0000-4000-8000-000000000551',
      expected: 1,
      instruction: 'Add an optional tag.',
      kind: 'revise',
      baseRevision: 1,
      demo: 'none',
    },
    transport,
  );
  expect(revised.changes.some((change) => change.path === 'src/calc.ts' && change.kind === 'unchanged')).toBe(true);
  expect(revised.changes.some((change) => change.path === 'src/types.ts' && change.kind === 'update')).toBe(true);
  await expect(
    approveArchitectApp({
      action: 'approve',
      projectId: state.projectId,
      requestId: '00000000-0000-4000-8000-000000000552',
      expected: 1,
      approvalHash: revised.approvalHash,
      proposal: {
        ...revised.proposal,
        operations: revised.proposal.operations?.map((operation) =>
          operation.path === 'src/types.ts' ? { ...operation, baseHash: 'e'.repeat(64) } : operation,
        ),
      },
      generation: revised.generation,
      baseRevision: 1,
    }),
  ).rejects.toThrow(/stale|no longer matches|base hash/i);
  const next = await approveArchitectApp({
    action: 'approve',
    projectId: state.projectId,
    requestId: '00000000-0000-4000-8000-000000000553',
    expected: 1,
    approvalHash: revised.approvalHash,
    proposal: revised.proposal,
    generation: revised.generation,
    baseRevision: 1,
  });
  await startArchitectApp({
    action: 'start',
    projectId: state.projectId,
    revisionId: next.revision.id,
    requestId: next.revision.id,
    expected: 1,
    approvalHash: next.revision.approval_hash,
  });
  await processAppBuildOnce(appStore(), 'worker-a', new Date(), {
    build: isolatedBuild('<html><body><h1>Field notes tagged</h1></body></html>'),
  });
  const afterRevision = await readArchitectApp(state.projectId);
  expect(afterRevision.current?.revision).toBe(2);
  expect(afterRevision.preview?.srcDoc).toMatch(/tagged/);
  const historical = await readArchitectApp(state.projectId, 1);
  expect(historical.selected?.revision).toBe(1);
  expect(historical.preview?.srcDoc).toMatch(/Field notes/);
  expect(historical.preview?.srcDoc).not.toMatch(/tagged/);
  const reopened = await reopenArchitectApp({
    action: 'reopen',
    projectId: state.projectId,
    revision: 1,
  });
  expect(reopened.selectedRevision).toBe(1);
  expect(reopened.preview.srcDoc).toMatch(/Field notes/);
  expect(reopened.preview.revision).toBe(1);
  const stillListed = await operateArchitectAppData({
    projectId: state.projectId,
    revisionId: approved.revision.id,
    session,
    requestId: '00000000-0000-4000-8000-000000000535',
    operation: 'list',
    collection: 'notes',
  });
  expect(stillListed.records).toHaveLength(1);
  const later = await proposeArchitectApp(
    {
      action: 'propose',
      projectId: state.projectId,
      requestId: '00000000-0000-4000-8000-000000000561',
      expected: 1,
      instruction: 'Add an optional tag.',
      kind: 'revise',
      baseRevision: 2,
      demo: 'none',
    },
    transport,
  );
  const third = await approveArchitectApp({
    action: 'approve',
    projectId: state.projectId,
    requestId: '00000000-0000-4000-8000-000000000562',
    expected: 1,
    approvalHash: later.approvalHash,
    proposal: later.proposal,
    generation: later.generation,
    baseRevision: 2,
  });
  await startArchitectApp({
    action: 'start',
    projectId: state.projectId,
    revisionId: third.revision.id,
    requestId: third.revision.id,
    expected: 1,
    approvalHash: third.revision.approval_hash,
  });
  await processAppBuildOnce(appStore(), 'worker-b', new Date(), {
    build: async () => ({
      result: {
        ok: false,
        isolation: 'docker',
        sandbox: false,
        typecheck: { ok: false, log: 'broken' },
        bundle: { ok: false, log: '' },
        blocker: 'Typecheck failed. The last successful application is retained.',
        stages: [],
      },
      artifacts: [],
      manifestHash: null,
    }),
  });
  const failed = await readArchitectApp(state.projectId);
  expect(failed.working?.revision).toBe(2);
  expect(failed.preview?.srcDoc).toMatch(/tagged/);
  const hostFixtureReject = acceptAppBuildSuccess(
    {
      ok: true,
      isolation: 'host-fixture',
      sandbox: false,
      typecheck: { ok: true, log: '' },
      bundle: { ok: true, log: '' },
      blocker: null,
      stages: [],
    },
    { mode: 'mock' },
  );
  expect(hostFixtureReject).toBe('reject');
  expect(await appStore().readRevision(state.other, approved.revision.id)).toBeNull();
  expect(await appStore().readArtifact(state.other, approved.revision.id)).toBeNull();
  const queued = await startArchitectApp({
    action: 'start',
    projectId: state.projectId,
    revisionId: third.revision.id,
    requestId: '00000000-0000-4000-8000-000000000571',
    expected: 1,
    approvalHash: third.revision.approval_hash,
  });
  const cancelled = await cancelArchitectApp({ action: 'cancel', projectId: state.projectId, jobId: queued.id });
  expect(cancelled.status).toBe('cancelled');
  await mkdir('test-results', { recursive: true });
  await writeFile(
    'test-results/architect-apps-journey-preview.html',
    reopened.preview.srcDoc,
    'utf8',
  );
});
