import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({
  owner: '00000000-0000-4000-8000-000000000001',
  other: '00000000-0000-4000-8000-000000000002',
  projectId: '00000000-0000-4000-8000-000000000003',
  otherProject: '00000000-0000-4000-8000-000000000004',
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
                  content: { name: 'Tracker', blueprint: { vision: 'Ship a usable tracker.' } },
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
  requireAppsGenerationAccess,
  startArchitectApp,
} from '@/domains/architect-apps/service';
import { MemoryAppStore } from '@/domains/architect-apps/store';
import { processAppBuildOnce } from '@/domains/architect-apps/worker';
import { resetPreviewSessions, signPreviewSession } from '@/domains/architect-apps/preview';
import { isSealedAppPath } from '@/domains/architect-apps/catalog';
import { notesProposal } from '@/domains/architect-apps/notes-fixture';

beforeEach(() => {
  vi.stubEnv('ARCHITECT_ORIGIN_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_APPS_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_APPS_STORE', 'memory');
  vi.stubEnv('ARCHITECT_APPS_FIXTURE', 'true');
  vi.stubEnv('ARCHITECT_APPS_PREVIEW_SECRET', 'service-preview-secret-key');
  vi.stubEnv('APP_ENV', 'local');
  resetPreviewSessions();
  const store = appStore() as MemoryAppStore;
  store.apps.clear();
  store.revisions.clear();
  store.artifacts.clear();
  store.jobs.clear();
  store.events.length = 0;
  store.records.clear();
  state.revision = 1;
});

async function approveTracker() {
  const proposed = await proposeArchitectApp({
    action: 'propose',
    projectId: state.projectId,
    requestId: '00000000-0000-4000-8000-000000000401',
    expected: 1,
    instruction: 'Create a project tracker.',
    kind: 'create',
    demo: 'tracker',
  });
  return approveArchitectApp({
    action: 'approve',
    projectId: state.projectId,
    requestId: '00000000-0000-4000-8000-000000000402',
    expected: 1,
    approvalHash: proposed.approvalHash,
    proposal: proposed.proposal,
    generation: proposed.generation,
    baseRevision: proposed.baseRevision,
  });
}

it('generates multiple source files, keeps toolchain sealed, and does not start on approve', async () => {
  const proposed = await proposeArchitectApp({
    action: 'propose',
    projectId: state.projectId,
    requestId: '00000000-0000-4000-8000-000000000401',
    expected: 1,
    instruction: 'Create a project tracker.',
    kind: 'create',
    demo: 'tracker',
  });
  expect(proposed.generation.mode).toBe('fixture');
  expect(proposed.generation.notes).toMatch(/not a live model generation/i);
  expect(proposed.proposal.files.length).toBeGreaterThan(6);
  expect(proposed.proposal.files.every((file) => file.path.startsWith('src/'))).toBe(true);
  expect(proposed.proposal.behaviors.persistence).toBe(true);
  const approved = await approveArchitectApp({
    action: 'approve',
    projectId: state.projectId,
    requestId: '00000000-0000-4000-8000-000000000402',
    expected: 1,
    approvalHash: proposed.approvalHash,
    proposal: proposed.proposal,
    generation: proposed.generation,
    baseRevision: null,
  });
  expect(approved.revision.files.some((file) => isSealedAppPath(file.path))).toBe(true);
  expect(approved.revision.status).toBe('approved');
  const library = await readArchitectApp(state.projectId);
  expect(library.pendingStart?.requestId).toBe(approved.revision.id);
  expect(library.jobs).toHaveLength(0);
});

it('recovers an approved unstarted revision, starts once, and retries a lost response', async () => {
  const approved = await approveTracker();
  const first = await startArchitectApp({
    action: 'start',
    projectId: state.projectId,
    revisionId: approved.revision.id,
    requestId: approved.revision.id,
    expected: 1,
    approvalHash: approved.revision.approval_hash,
  });
  const second = await startArchitectApp({
    action: 'start',
    projectId: state.projectId,
    revisionId: approved.revision.id,
    requestId: approved.revision.id,
    expected: 1,
    approvalHash: approved.revision.approval_hash,
  });
  expect(first.id).toBe(approved.revision.id);
  expect(second.id).toBe(first.id);
  expect([...((appStore() as MemoryAppStore).jobs.values())]).toHaveLength(1);
});

it('rejects a stale project revision and a stale file hash', async () => {
  const proposed = await proposeArchitectApp({
    action: 'propose',
    projectId: state.projectId,
    requestId: '00000000-0000-4000-8000-000000000411',
    expected: 1,
    instruction: 'Create a project tracker.',
    kind: 'create',
    demo: 'tracker',
  });
  state.revision = 2;
  await expect(
    approveArchitectApp({
      action: 'approve',
      projectId: state.projectId,
      requestId: '00000000-0000-4000-8000-000000000412',
      expected: 1,
      approvalHash: proposed.approvalHash,
      proposal: proposed.proposal,
      generation: proposed.generation,
      baseRevision: null,
    }),
  ).rejects.toThrow(/project revision changed/i);
  state.revision = 1;
  await expect(
    approveArchitectApp({
      action: 'approve',
      projectId: state.projectId,
      requestId: '00000000-0000-4000-8000-000000000413',
      expected: 1,
      approvalHash: 'b'.repeat(64),
      proposal: proposed.proposal,
      generation: proposed.generation,
      baseRevision: null,
    }),
  ).rejects.toThrow(/no longer matches the reviewed application files/i);
});

it('keeps the last working app when a later build fails and isolates owners', async () => {
  const approved = await approveTracker();
  await startArchitectApp({
    action: 'start',
    projectId: state.projectId,
    revisionId: approved.revision.id,
    requestId: approved.revision.id,
    expected: 1,
    approvalHash: approved.revision.approval_hash,
  });
  await processAppBuildOnce(appStore(), 'worker-a', new Date(), {
    build: async () => ({
      result: {
        ok: true,
        isolation: 'host-fixture',
        sandbox: false,
        typecheck: { ok: true, log: 'ok' },
        bundle: { ok: true, log: 'ok' },
        blocker: 'Host-fixture toolchain.',
        stages: [],
      },
      artifacts: [
        {
          path: 'index.html',
          content:
            '<!doctype html><html><head></head><body><div id="root"></div><script type="module" src="./assets/app.js"></script></body></html>',
        },
        { path: 'assets/app.js', content: 'document.getElementById("root").innerHTML="<h1>tracker</h1>";' },
      ],
      manifestHash: 'c'.repeat(64),
    }),
  });
  const first = await readArchitectApp(state.projectId);
  expect(first.working?.revision).toBe(1);
  expect(first.preview?.srcDoc).toMatch(/tracker/);
  const revised = await proposeArchitectApp({
    action: 'propose',
    projectId: state.projectId,
    requestId: '00000000-0000-4000-8000-000000000421',
    expected: 1,
    instruction: 'Add priority filtering.',
    kind: 'revise',
    baseRevision: 1,
    demo: 'tracker',
  });
  expect(revised.changes.some((change) => change.path === 'src/pages/Board.tsx' && change.kind === 'update')).toBe(true);
  expect(revised.changes.some((change) => change.path === 'src/calc.ts' && change.kind === 'unchanged')).toBe(true);
  const next = await approveArchitectApp({
    action: 'approve',
    projectId: state.projectId,
    requestId: '00000000-0000-4000-8000-000000000422',
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
    build: async () => ({
      result: {
        ok: false,
        isolation: 'host-fixture',
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
  const library = await readArchitectApp(state.projectId);
  expect(library.current?.revision).toBe(2);
  expect(library.current?.status).toBe('failed');
  expect(library.working?.revision).toBe(1);
  expect(library.preview?.srcDoc).toMatch(/tracker/);
  const foreign = await appStore().readRevision(state.other, approved.revision.id);
  expect(foreign).toBeNull();
});

it('cancels a queued job and stores host records against the app, not the preview session', async () => {
  const approved = await approveTracker();
  const job = await startArchitectApp({
    action: 'start',
    projectId: state.projectId,
    revisionId: approved.revision.id,
    requestId: approved.revision.id,
    expected: 1,
    approvalHash: approved.revision.approval_hash,
  });
  const cancelled = await cancelArchitectApp({
    action: 'cancel',
    projectId: state.projectId,
    jobId: job.id,
  });
  expect(cancelled.status).toBe('cancelled');
  await startArchitectApp({
    action: 'start',
    projectId: state.projectId,
    revisionId: approved.revision.id,
    requestId: '00000000-0000-4000-8000-000000000434',
    expected: 1,
    approvalHash: approved.revision.approval_hash,
  });
  await processAppBuildOnce(appStore(), 'worker-a', new Date(), {
    build: async () => ({
      result: {
        ok: true,
        isolation: 'host-fixture' as const,
        sandbox: false,
        typecheck: { ok: true, log: 'ok' },
        bundle: { ok: true, log: 'ok' },
        blocker: 'Host-fixture toolchain.',
        stages: [],
      },
      artifacts: [
        {
          path: 'index.html',
          content:
            '<!doctype html><html><head></head><body><div id="root"></div><script type="module" src="./assets/app.js"></script></body></html>',
        },
        { path: 'assets/app.js', content: 'document.getElementById("root").innerHTML="<h1>tracker</h1>";' },
      ],
      manifestHash: 'c'.repeat(64),
    }),
  });
  const session = await signPreviewSession({
    personId: state.owner,
    projectId: state.projectId,
    revisionId: approved.revision.id,
    secret: 'service-preview-secret-key',
  });
  const created = await operateArchitectAppData({
    projectId: state.projectId,
    revisionId: approved.revision.id,
    session,
    requestId: '00000000-0000-4000-8000-000000000431',
    operation: 'create',
    collection: 'items',
    payload: { id: '00000000-0000-4000-8000-000000000441', title: 'Ship review', notes: '', status: 'open', hours: 2 },
    idempotencyKey: '00000000-0000-4000-8000-000000000711',
  });
  const replay = await operateArchitectAppData({
    projectId: state.projectId,
    revisionId: approved.revision.id,
    session,
    requestId: '00000000-0000-4000-8000-000000000432',
    operation: 'create',
    collection: 'items',
    payload: { id: '00000000-0000-4000-8000-000000000441', title: 'Ship review', notes: '', status: 'open', hours: 2 },
    idempotencyKey: '00000000-0000-4000-8000-000000000711',
  });
  expect((created.records[0] as { title?: string }).title).toBe('Ship review');
  expect(replay.records[0]?.id).toBe(created.records[0]?.id);
  const listed = await operateArchitectAppData({
    projectId: state.projectId,
    revisionId: approved.revision.id,
    session,
    requestId: '00000000-0000-4000-8000-000000000433',
    operation: 'list',
    collection: 'items',
  });
  expect(listed.records).toHaveLength(1);
});

it('requires server-verified founder access before the real generation path', async () => {
  vi.stubEnv('ARCHITECT_APPS_FIXTURE', '');
  vi.stubEnv('ARCHITECT_APPS_AI_ENABLED', 'true');
  vi.stubEnv('OPENAI_API_KEY', 'sk-test');
  await expect(requireAppsGenerationAccess(process.env, async () => false)).rejects.toThrow(/founder pilot/i);
  await expect(requireAppsGenerationAccess(process.env, async () => true)).resolves.toBeUndefined();
});

it('refuses ordinary owners on approve and start even when they own the project', async () => {
  vi.stubEnv('APP_ENV', 'production');
  vi.stubEnv('ARCHITECT_APPS_FOUNDER_PILOT', 'true');
  vi.stubEnv('ARCHITECT_APPS_AI_ENABLED', 'true');
  vi.stubEnv('OPENAI_API_KEY', 'sk-test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'hosted-publishable-key');
  await expect(
    approveArchitectApp(
      {
        action: 'approve',
        projectId: state.projectId,
        requestId: '00000000-0000-4000-8000-000000000451',
        expected: 1,
        approvalHash: 'a'.repeat(64),
        proposal: notesProposal(),
        generation: { mode: 'openai', notes: 'Model-generated application files recorded from the authorized OpenAI adapter.' },
        baseRevision: null,
      },
      { verifyFounder: async () => false },
    ),
  ).rejects.toThrow(/founder pilot/i);
  await expect(
    startArchitectApp(
      {
        action: 'start',
        projectId: state.projectId,
        revisionId: '00000000-0000-4000-8000-000000000452',
        requestId: '00000000-0000-4000-8000-000000000453',
        expected: 1,
        approvalHash: 'a'.repeat(64),
      },
      { verifyFounder: async () => false },
    ),
  ).rejects.toThrow(/founder pilot/i);
});

it('refuses mocked production source on approve even for a founder owner', async () => {
  vi.stubEnv('APP_ENV', 'production');
  vi.stubEnv('ARCHITECT_APPS_FOUNDER_PILOT', 'true');
  vi.stubEnv('ARCHITECT_APPS_AI_ENABLED', 'true');
  vi.stubEnv('OPENAI_API_KEY', 'sk-test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'hosted-publishable-key');
  await expect(
    approveArchitectApp(
      {
        action: 'approve',
        projectId: state.projectId,
        requestId: '00000000-0000-4000-8000-000000000454',
        expected: 1,
        approvalHash: 'a'.repeat(64),
        proposal: notesProposal(),
        generation: { mode: 'mock', notes: 'Labelled mocked provider.' },
        baseRevision: null,
      },
      { verifyFounder: async () => true },
    ),
  ).rejects.toThrow(/mocked or fixture application source/i);
});
