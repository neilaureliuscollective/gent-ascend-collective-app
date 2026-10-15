import { beforeEach, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
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
  operateArchitectAppData,
  proposeArchitectApp,
  readArchitectApp,
  startArchitectApp,
} from '@/domains/architect-apps/service';
import { MemoryAppStore } from '@/domains/architect-apps/store';
import { processAppBuildOnce } from '@/domains/architect-apps/worker';
import { mockedSupportedAppProposal } from '@/domains/architect-apps/provider';
import { assemblePreviewDocument, resetPreviewSessions, signPreviewSession } from '@/domains/architect-apps/preview';
import { resolveHostFixtureToolchain, buildGeneratedApp } from '@/domains/architect-apps/builder';
import { notesSourceFiles } from '@/domains/architect-apps/notes-fixture';
import { APP_BUNDLE_ENTRY } from '@/domains/architect-apps/bundle';
import {
  buildIsolatedGeneratedApp,
  collectArtifactTree,
  defaultAppsImage,
  isolatedArtifactCollectorModule,
  probeAppsDockerIsolation,
} from '@/domains/architect-apps/isolate';
import { APP_DATA_BRIDGE_CONTRACT } from '@/domains/architect-apps/context';

beforeEach(() => {
  vi.stubEnv('ARCHITECT_ORIGIN_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_APPS_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_APPS_STORE', 'memory');
  vi.stubEnv('ARCHITECT_APPS_AI_MOCK', 'true');
  vi.stubEnv('ARCHITECT_APPS_PREVIEW_SECRET', 'compiled-preview-secret-key');
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

it('compiles Field Notes, mounts the sealed bundle, and replays create/edit against durable records', async () => {
  const host = resolveHostFixtureToolchain();
  if (!host.typecheckBin || !host.viteBin) {
    expect(host.isolation).toBe('unavailable');
    return;
  }
  const compiled = await buildGeneratedApp(notesSourceFiles(), { host, timeoutMs: 90000 });
  expect(compiled.result.typecheck.ok, compiled.result.typecheck.log).toBe(true);
  expect(compiled.result.bundle.ok, compiled.result.bundle.log).toBe(true);
  expect(compiled.result.isolation).toBe('host-fixture');
  expect(compiled.result.sandbox).toBe(false);
  expect(compiled.artifacts.filter((file) => file.path.endsWith('.js'))).toHaveLength(1);
  expect(compiled.artifacts.some((file) => file.path === APP_BUNDLE_ENTRY)).toBe(true);
  const dist = await mkdtemp(join(tmpdir(), 'apps-compiled-'));
  for (const file of compiled.artifacts) {
    const target = join(dist, file.path);
    await mkdir(join(target, '..'), { recursive: true });
    await writeFile(target, file.content, 'utf8');
  }
  expect(collectArtifactTree(dist).map((file) => file.path).sort()).toEqual(
    compiled.artifacts.map((file) => file.path).sort(),
  );
  const collector = join(dist, 'collect.mjs');
  await writeFile(collector, isolatedArtifactCollectorModule, 'utf8');
  const walked = spawnSync(process.execPath, [collector, dist], { encoding: 'utf8' });
  expect(walked.status, walked.stderr).toBe(0);
  const collected = (JSON.parse(walked.stdout) as { path: string }[]).filter((file) => file.path !== 'collect.mjs');
  expect(collected.some((file) => file.path === APP_BUNDLE_ENTRY)).toBe(true);

  const transport = async (input: { kind: 'create' | 'revise'; files: { path: string; content: string; hash: string }[] }) => {
    expect(input.files.every((file) => file.hash && file.content != null)).toBe(true);
    expect(input).toMatchObject({ bridge: APP_DATA_BRIDGE_CONTRACT });
    return mockedSupportedAppProposal(input);
  };
  const proposed = await proposeArchitectApp(
    {
      action: 'propose',
      projectId: state.projectId,
      requestId: '00000000-0000-4000-8000-000000000801',
      expected: 1,
      instruction: 'Create field notes I can save.',
      kind: 'create',
      demo: 'none',
    },
    transport,
  );
  expect(proposed.generation.mode).toBe('mock');
  expect(proposed.generation.notes).toMatch(/not a paid OpenAI call/i);
  const approved = await approveArchitectApp({
    action: 'approve',
    projectId: state.projectId,
    requestId: '00000000-0000-4000-8000-000000000802',
    expected: 1,
    approvalHash: proposed.approvalHash,
    proposal: proposed.proposal,
    generation: proposed.generation,
    baseRevision: null,
  });
  await startArchitectApp({
    action: 'start',
    projectId: state.projectId,
    revisionId: approved.revision.id,
    requestId: approved.revision.id,
    expected: 1,
    approvalHash: approved.revision.approval_hash,
  });
  const store = appStore() as MemoryAppStore;
  await store.saveArtifact({
    revision_id: approved.revision.id,
    person_id: state.owner,
    project_id: state.projectId,
    manifest_hash: compiled.manifestHash ?? 'e'.repeat(64),
    files: compiled.artifacts,
    created_at: new Date().toISOString(),
  });
  await store.markRevisionStatus(state.owner, approved.revision.id, 'ready', true);
  const ready = await readArchitectApp(state.projectId);
  expect(ready.current?.status).toBe('ready');
  expect(compiled.result.isolation).toBe('host-fixture');
  expect(compiled.result.sandbox).toBe(false);
  expect(ready.preview?.entry).toBe(APP_BUNDLE_ENTRY);
  expect(ready.preview?.srcDoc).toMatch(/createRoot|Field notes/i);
  expect(ready.preview?.csp).toMatch(/sandbox allow-scripts/);
  expect(ready.preview?.csp).not.toMatch(/allow-same-origin/);
  const session = await signPreviewSession({
    personId: state.owner,
    projectId: state.projectId,
    revisionId: approved.revision.id,
    secret: 'compiled-preview-secret-key',
  });
  const created = await operateArchitectAppData({
    projectId: state.projectId,
    revisionId: approved.revision.id,
    session,
    requestId: '00000000-0000-4000-8000-000000000831',
    operation: 'create',
    collection: 'notes',
    payload: { id: '00000000-0000-4000-8000-000000000841', title: 'Site visit', body: 'North wall', hours: 2 },
    idempotencyKey: '00000000-0000-4000-8000-000000000851',
  });
  const replayCreate = await operateArchitectAppData({
    projectId: state.projectId,
    revisionId: approved.revision.id,
    session,
    requestId: '00000000-0000-4000-8000-000000000832',
    operation: 'create',
    collection: 'notes',
    payload: { id: '00000000-0000-4000-8000-000000000841', title: 'Site visit', body: 'North wall', hours: 2 },
    idempotencyKey: '00000000-0000-4000-8000-000000000851',
  });
  expect((created.records[0] as { title?: string }).title).toBe('Site visit');
  expect((replayCreate.records[0] as { title?: string }).title).toBe('Site visit');
  await expect(
    operateArchitectAppData({
      projectId: state.projectId,
      revisionId: approved.revision.id,
      session,
      requestId: '00000000-0000-4000-8000-000000000836',
      operation: 'create',
      collection: 'notes',
      payload: { id: '00000000-0000-4000-8000-000000000841', title: 'Changed', body: 'North wall', hours: 2 },
      idempotencyKey: '00000000-0000-4000-8000-000000000851',
    }),
  ).rejects.toThrow(/mutation identity|different record/i);
  const edited = await operateArchitectAppData({
    projectId: state.projectId,
    revisionId: approved.revision.id,
    session,
    requestId: '00000000-0000-4000-8000-000000000833',
    operation: 'update',
    collection: 'notes',
    payload: { id: '00000000-0000-4000-8000-000000000841', title: 'Site visit edited', body: 'North wall', hours: 3 },
    idempotencyKey: '00000000-0000-4000-8000-000000000852',
    expectedVersion: 1,
  });
  const retryEdit = await operateArchitectAppData({
    projectId: state.projectId,
    revisionId: approved.revision.id,
    session,
    requestId: '00000000-0000-4000-8000-000000000834',
    operation: 'update',
    collection: 'notes',
    payload: { id: '00000000-0000-4000-8000-000000000841', title: 'Site visit edited', body: 'North wall', hours: 3 },
    idempotencyKey: '00000000-0000-4000-8000-000000000852',
    expectedVersion: 1,
  });
  expect((edited.records[0] as { title?: string }).title).toBe('Site visit edited');
  expect((retryEdit.records[0] as { title?: string }).title).toBe('Site visit edited');
  const editB = await operateArchitectAppData({
    projectId: state.projectId,
    revisionId: approved.revision.id,
    session,
    requestId: '00000000-0000-4000-8000-000000000837',
    operation: 'update',
    collection: 'notes',
    payload: { id: '00000000-0000-4000-8000-000000000841', title: 'Site visit B', body: 'North wall', hours: 4 },
    idempotencyKey: '00000000-0000-4000-8000-000000000853',
    expectedVersion: 2,
  });
  expect((editB.records[0] as { title?: string }).title).toBe('Site visit B');
  const listed = await operateArchitectAppData({
    projectId: state.projectId,
    revisionId: approved.revision.id,
    session,
    requestId: '00000000-0000-4000-8000-000000000835',
    operation: 'list',
    collection: 'notes',
  });
  expect(listed.records).toHaveLength(1);
  expect(await store.listRecords(state.other, approved.revision.app_id, 'notes')).toEqual([]);
  expect(await store.readRecord(state.owner, 'other-app', 'notes', created.records[0]!.id as string)).toBeNull();
  await store
    .writeRecord({
      personId: state.other,
      projectId: state.projectId,
      appId: approved.revision.app_id,
      collection: 'notes',
      payload: { title: 'Foreign' },
      id: created.records[0]!.id as string,
    })
    .then(
      () => {
        throw new Error('foreign write must fail');
      },
      (error: unknown) => {
        expect(String(error)).toMatch(/unavailable/i);
      },
    );

  const later = await proposeArchitectApp(
    {
      action: 'propose',
      projectId: state.projectId,
      requestId: '00000000-0000-4000-8000-000000000861',
      expected: 1,
      instruction: 'Add an optional tag.',
      kind: 'revise',
      baseRevision: 1,
      demo: 'none',
    },
    transport,
  );
  const third = await approveArchitectApp({
    action: 'approve',
    projectId: state.projectId,
    requestId: '00000000-0000-4000-8000-000000000862',
    expected: 1,
    approvalHash: later.approvalHash,
    proposal: later.proposal,
    generation: later.generation,
    baseRevision: 1,
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
  expect(failed.working?.revision).toBe(1);
  expect(failed.preview?.entry).toBe(APP_BUNDLE_ENTRY);
  const docker = await probeAppsDockerIsolation({ PATH: process.env.PATH });
  expect(compiled.result.isolation).toBe('host-fixture');
  expect(compiled.result.sandbox).toBe(false);
  if (process.env.ARCHITECT_APPS_REQUIRE_ISOLATION === 'true' && docker.available) {
    const image = spawnSync('docker', ['image', 'inspect', '--format', '{{.Id}}', defaultAppsImage], { encoding: 'utf8' });
    if (image.status === 0) {
      const isolated = await buildIsolatedGeneratedApp(notesSourceFiles(), {
        timeoutMs: 180000,
        name: 'apps-journey-ci',
      });
      expect(
        isolated.result.ok,
        isolated.result.blocker ?? `${isolated.result.typecheck.log}\n${isolated.result.bundle.log}`,
      ).toBe(true);
      expect(isolated.result.isolation).toBe('docker');
      expect(isolated.result.sandbox).toBe(true);
      expect(isolated.artifacts.some((file) => file.path === APP_BUNDLE_ENTRY)).toBe(true);
    }
  }
  const preview = assemblePreviewDocument({
    artifacts: compiled.artifacts,
    session,
    parentOrigin: 'http://127.0.0.1:3100',
    title: 'Field notes',
    revision: 1,
    revisionId: approved.revision.id,
  });
  await mkdir('test-results', { recursive: true });
  await mkdir('docs/evidence/architect-apps', { recursive: true });
  await writeFile('test-results/architect-apps-compiled-preview.html', preview.srcDoc, 'utf8');
  await writeFile('docs/evidence/architect-apps/compiled-preview.html', preview.srcDoc, 'utf8');
  expect(preview.srcDoc).toMatch(/Field notes|createRoot/i);
  const entry = compiled.artifacts.find((file) => file.path === APP_BUNDLE_ENTRY)?.content ?? '';
  if (entry.includes('$&')) {
    expect(preview.srcDoc).toContain('$&');
    expect(preview.srcDoc).not.toContain('</body>/');
  }
}, 180000);
