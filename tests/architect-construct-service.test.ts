import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({
  owner: '00000000-0000-4000-8000-000000000001',
  revision: 1,
  projectId: '00000000-0000-4000-8000-000000000003',
  error: null as { message: string } | null,
}));
const connections = vi.hoisted(() => ({
  verify: vi.fn(
    async (): Promise<{
      repository: string;
      commit: string;
      files: { path: string; content: string }[];
      verified: true;
    }> => {
      throw new Error('Git pin is not configured in this unit test.');
    },
  ),
}));
vi.mock('@/domains/architect-construct/connections-source', () => ({
  verifyConstructGitPin: connections.verify,
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
                data: state.error
                  ? null
                  : {
                      id: state.projectId,
                      person_id: state.owner,
                      revision: state.revision,
                      content: { status: 'active', name: 'Synthetic' },
                    },
                error: state.error,
              }),
            }),
          }),
        }),
      }),
    },
  }),
}));
import {
  approveConstructChange,
  approveRepairConstruct,
  cancelConstruct,
  constructStore,
  proposeRepairConstruct,
  readConstruct,
  startConstruct,
  startFixtureConstruct,
} from '@/domains/architect-construct/service';
import { approvalHash } from '@/domains/architect-construct/hash';
import { fixtureScope, fixtureSource } from '@/domains/architect-construct/fixture';
import { defaultLimits, defaultProtectedPaths } from '@/domains/architect-construct/schema';

beforeEach(() => {
  vi.stubEnv('ARCHITECT_ORIGIN_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_CONSTRUCT_ENABLED', 'true');
  vi.stubEnv('ARCHITECT_CONSTRUCT_STORE', 'memory');
  state.owner = '00000000-0000-4000-8000-000000000001';
  state.revision = 1;
  state.error = null;
  const store = constructStore() as unknown as {
    sources: Map<string, unknown>;
    briefs: Map<string, unknown>;
    runs: Map<string, unknown>;
    events: unknown[];
  };
  store.sources.clear();
  store.briefs.clear();
  store.runs.clear();
  store.events.length = 0;
  connections.verify.mockReset();
  connections.verify.mockImplementation(async () => {
    throw new Error('Git pin is not configured in this unit test.');
  });
});

it('starts a fixture once and returns the same run on duplicate click', async () => {
  const requestId = '00000000-0000-4000-8000-000000000021';
  const first = await startFixtureConstruct({
    action: 'start-fixture',
    projectId: state.projectId,
    requestId,
    expected: 1,
  });
  const second = await startFixtureConstruct({
    action: 'start-fixture',
    projectId: state.projectId,
    requestId,
    expected: 1,
  });
  expect(first.id).toBe(requestId);
  expect(second.id).toBe(first.id);
  expect(second.status).toBe('queued');
  expect(first.source_kind).toBe('imported');
  expect((await constructStore().readSource(state.owner, first.source_id))?.kind).toBe('imported');
  expect([...constructStore()['runs' as never] as Map<string, unknown>].length).toBe(1);
});

it('rejects a stale project revision and a forged expanded scope', async () => {
  const requestId = '00000000-0000-4000-8000-000000000022';
  await startFixtureConstruct({
    action: 'start-fixture',
    projectId: state.projectId,
    requestId,
    expected: 1,
  });
  const staleBrief = await constructStore().readBrief(state.owner, requestId);
  state.revision = 2;
  await expect(
    startConstruct({
      action: 'start',
      projectId: state.projectId,
      briefId: requestId,
      requestId: '00000000-0000-4000-8000-000000000023',
      expected: 2,
      approvalHash: staleBrief!.approval_hash,
    }),
  ).rejects.toThrow(/invalid|changed|revision/i);
  const source = fixtureSource(state.owner, '00000000-0000-4000-8000-000000000024');
  await constructStore().importSource(source);
  const forged = fixtureScope({
    projectId: state.projectId,
    projectRevision: 2,
    sourceId: source.id,
    sourceTreeHash: source.tree_hash,
  });
  forged.allowed_paths.push('secrets/key');
  forged.protected_paths = defaultProtectedPaths();
  forged.resource_limits = defaultLimits;
  const brief = await constructStore().approveBrief(state.owner, '00000000-0000-4000-8000-000000000025', {
    ...forged,
    allowed_paths: ['preview.html'],
  });
  expect(brief.approval_hash).toBe(approvalHash(brief.scope));
  expect(brief.scope.allowed_paths).not.toContain('secrets/key');
});

it('approves an imported change then starts that brief once', async () => {
  const briefId = '00000000-0000-4000-8000-000000000027';
  const sourceId = '00000000-0000-4000-8000-000000000028';
  const requestId = '00000000-0000-4000-8000-000000000029';
  const files = fixtureSource(state.owner, sourceId).files;
  const approved = await approveConstructChange({
    action: 'approve-change',
    projectId: state.projectId,
    briefId,
    sourceId,
    expected: 1,
    sourceKind: 'imported',
    repository: null,
    commit: null,
    files,
    intendedChange: 'Replace the fixture heading Before with After.',
    allowedPaths: files.map((file) => file.path),
    protectedPaths: defaultProtectedPaths(),
    acceptanceChecks: [
      { name: 'syntax', command: 'node', args: ['--check', 'check.mjs'] },
      { name: 'heading', command: 'node', args: ['check.mjs'] },
    ],
    patch: fixtureScope({
      projectId: state.projectId,
      projectRevision: 1,
      sourceId,
      sourceTreeHash: 'a'.repeat(64),
    }).patch,
  });
  expect(approved.brief.status).toBe('approved');
  expect(approved.source.kind).toBe('imported');
  const first = await startConstruct({
    action: 'start',
    projectId: state.projectId,
    briefId,
    requestId,
    expected: 1,
    approvalHash: approved.brief.approval_hash,
  });
  const second = await startConstruct({
    action: 'start',
    projectId: state.projectId,
    briefId,
    requestId,
    expected: 1,
    approvalHash: approved.brief.approval_hash,
  });
  expect(first.id).toBe(requestId);
  expect(second.id).toBe(first.id);
  expect(first.source_kind).toBe('imported');
  expect([...constructStore()['runs' as never] as Map<string, unknown>].length).toBe(1);
  await expect(
    startConstruct({
      action: 'start',
      projectId: state.projectId,
      briefId,
      requestId,
      expected: 1,
      approvalHash: 'c'.repeat(64),
    }),
  ).rejects.toThrow(/digest|reserved|invalid/i);
});

it('stores a server-verified Git pin rather than the browser label', async () => {
  const files = fixtureSource(state.owner, '00000000-0000-4000-8000-000000000045').files;
  connections.verify.mockResolvedValueOnce({
    repository: 'acme/site',
    commit: 'a'.repeat(40),
    files,
    verified: true as const,
  });
  const approved = await approveConstructChange({
    action: 'approve-change',
    projectId: state.projectId,
    briefId: '00000000-0000-4000-8000-000000000046',
    sourceId: '00000000-0000-4000-8000-000000000047',
    expected: 1,
    sourceKind: 'git',
    repository: 'acme/site',
    commit: 'a'.repeat(40),
    files,
    intendedChange: 'Verified Git pin.',
    allowedPaths: files.map((file) => file.path),
    protectedPaths: defaultProtectedPaths(),
    acceptanceChecks: [{ name: 'present', command: 'true', args: [] }],
    patch: fixtureScope({
      projectId: state.projectId,
      projectRevision: 1,
      sourceId: '00000000-0000-4000-8000-000000000047',
      sourceTreeHash: 'a'.repeat(64),
    }).patch,
  });
  expect(approved.source.kind).toBe('git');
  expect(approved.source.label).toMatch(/Git pin acme\/site@/);
  expect(approved.source.repository).toBe('acme/site');
  expect(approved.source.commit).toBe('a'.repeat(40));
});

it('labels imported Git files as modified after the pin is edited', async () => {
  const files = fixtureSource(state.owner, '00000000-0000-4000-8000-000000000040').files;
  connections.verify.mockResolvedValueOnce({
    repository: 'acme/site',
    commit: 'a'.repeat(40),
    files: files.map((file) =>
      file.path === 'preview.html' ? { ...file, content: 'FROM_GIT' } : file,
    ),
    verified: true as const,
  });
  const approved = await approveConstructChange({
    action: 'approve-change',
    projectId: state.projectId,
    briefId: '00000000-0000-4000-8000-000000000041',
    sourceId: '00000000-0000-4000-8000-000000000042',
    expected: 1,
    sourceKind: 'imported',
    repository: 'acme/site',
    commit: 'a'.repeat(40),
    files,
    intendedChange: 'Edited after a Git pin.',
    allowedPaths: files.map((file) => file.path),
    protectedPaths: defaultProtectedPaths(),
    acceptanceChecks: [{ name: 'present', command: 'true', args: [] }],
    patch: fixtureScope({
      projectId: state.projectId,
      projectRevision: 1,
      sourceId: '00000000-0000-4000-8000-000000000042',
      sourceTreeHash: 'a'.repeat(64),
    }).patch,
  });
  expect(approved.source.kind).toBe('imported');
  expect(approved.source.label).toMatch(/Imported\/modified snapshot/);
  expect(approved.source.label).toMatch(/not verified unchanged Git content/);
});

it('refuses unsupported creation and does not treat emptying as deletion', async () => {
  const files = fixtureSource(state.owner, '00000000-0000-4000-8000-000000000048').files;
  await expect(
    approveConstructChange({
      action: 'approve-change',
      projectId: state.projectId,
      briefId: '00000000-0000-4000-8000-000000000049',
      sourceId: '00000000-0000-4000-8000-000000000050',
      expected: 1,
      sourceKind: 'imported',
      repository: null,
      commit: null,
      files,
      intendedChange: 'Create a new file.',
      allowedPaths: [...files.map((file) => file.path), 'brand-new.js'],
      protectedPaths: defaultProtectedPaths(),
      acceptanceChecks: [],
      patch: [{ path: 'brand-new.js', before: '', after: 'export const created = true;\n' }],
    }),
  ).rejects.toThrow(/creating|not supported/i);
  const emptied = await approveConstructChange({
    action: 'approve-change',
    projectId: state.projectId,
    briefId: '00000000-0000-4000-8000-000000000066',
    sourceId: '00000000-0000-4000-8000-000000000067',
    expected: 1,
    sourceKind: 'imported',
    repository: null,
    commit: null,
    files,
    intendedChange: 'Empty the readme without deleting it.',
    allowedPaths: files.map((file) => file.path),
    protectedPaths: defaultProtectedPaths(),
    acceptanceChecks: [],
    patch: [{ path: 'README.md', before: files[0]!.content, after: '' }],
  });
  expect(emptied.brief.scope.patch[0]?.after).toBe('');
  expect(emptied.brief.scope.patch[0]?.path).toBe('README.md');
  expect(emptied.source.files.some((file) => file.path === 'README.md')).toBe(true);
});

it('keeps cancel owner-scoped and does not replay a finished request', async () => {
  const requestId = '00000000-0000-4000-8000-000000000026';
  await startFixtureConstruct({
    action: 'start-fixture',
    projectId: state.projectId,
    requestId,
    expected: 1,
  });
  const cancelled = await cancelConstruct({
    action: 'cancel',
    projectId: state.projectId,
    runId: requestId,
  });
  expect(cancelled.status).toBe('cancelled');
  const replay = await startFixtureConstruct({
    action: 'start-fixture',
    projectId: state.projectId,
    requestId,
    expected: 1,
  });
  expect(replay.status).toBe('cancelled');
  state.owner = '00000000-0000-4000-8000-000000000002';
  await expect(
    cancelConstruct({ action: 'cancel', projectId: state.projectId, runId: requestId }),
  ).rejects.toThrow(/unavailable|not/i);
});

it('repairs a failed original once, refuses repair-of-repair and stale revisions, and retries the same request', async () => {
  vi.stubEnv('ARCHITECT_CONSTRUCT_AI_MOCK', 'true');
  vi.stubEnv('APP_ENV', 'local');
  vi.stubEnv('NODE_ENV', 'development');
  const files = [{ path: 'ok.mjs', content: 'export const heading = "Before";\n' }];
  const failed = 'export const heading = "After"\nconst introduced = ;\n';
  const approved = await approveConstructChange({
    action: 'approve-change',
    projectId: state.projectId,
    briefId: '00000000-0000-4000-8000-0000000000a1',
    sourceId: '00000000-0000-4000-8000-0000000000a2',
    expected: 1,
    sourceKind: 'imported',
    repository: null,
    commit: null,
    files,
    intendedChange: 'Introduce the labelled syntax fixture.',
    allowedPaths: ['ok.mjs'],
    protectedPaths: defaultProtectedPaths(),
    acceptanceChecks: [{ name: 'syntax:ok.mjs', command: 'node', args: ['--check', 'ok.mjs'] }],
    patch: [{ path: 'ok.mjs', before: files[0]!.content, after: failed }],
  });
  const parentId = '00000000-0000-4000-8000-0000000000a3';
  await startConstruct({
    action: 'start',
    projectId: state.projectId,
    briefId: approved.brief.id,
    requestId: parentId,
    expected: 1,
    approvalHash: approved.brief.approval_hash,
  });
  const stored = (
    constructStore() as unknown as { runs: Map<string, { status: string; result: unknown }> }
  ).runs.get(parentId)!;
  stored.status = 'failed';
  stored.result = {
    isolation: 'process-fixture',
    runtime_available: false,
    sandbox: false,
    blocker: 'Introduced syntax failure.',
    source_hash: approved.source.tree_hash,
    result_hash: null,
    changed_files: ['ok.mjs'],
    diff: '',
    checks: [
      {
        name: 'syntax:ok.mjs',
        command: 'node --check ok.mjs',
        exit_code: 1,
        status: 'failed',
        log: 'SyntaxError',
      },
    ],
    coverage: {
      no_applicable: false,
      preexisting_failures: [],
      introduced_failures: ['syntax:node --check ok.mjs:ok.mjs'],
      untested: [],
      unsupported: [{ kind: 'typecheck', reason: 'Unsupported in this sandbox.' }],
      revision_note: '1',
    },
    preview: { path: null, body: '', unavailable_reason: 'none' },
    artifacts: [],
  };
  const proposed = await proposeRepairConstruct(
    { action: 'propose-repair', projectId: state.projectId, parentRunId: parentId },
    new AbortController().signal,
  );
  expect(proposed.proposal.patch[0]?.before).toBe(failed);
  expect(proposed.combined[0]?.before).toBe(files[0]!.content);
  const repairBriefId = '00000000-0000-4000-8000-0000000000a4';
  const approvedRepair = await approveRepairConstruct({
    action: 'approve-repair',
    projectId: state.projectId,
    briefId: repairBriefId,
    parentRunId: parentId,
    expected: 1,
    patch: proposed.proposal.patch,
    generation: { mode: 'mock', notes: 'Labelled demonstration. Not a paid OpenAI call.' },
  });
  expect(approvedRepair.brief.scope.project_revision).toBe(1);
  expect(approvedRepair.brief.scope.repair?.parent_run_id).toBe(parentId);
  expect(approvedRepair.brief.approval_hash).not.toBe(approved.brief.approval_hash);
  const first = await startConstruct({
    action: 'start',
    projectId: state.projectId,
    briefId: approvedRepair.brief.id,
    requestId: approvedRepair.brief.id,
    expected: 1,
    approvalHash: approvedRepair.brief.approval_hash,
  });
  const retry = await startConstruct({
    action: 'start',
    projectId: state.projectId,
    briefId: approvedRepair.brief.id,
    requestId: approvedRepair.brief.id,
    expected: 1,
    approvalHash: approvedRepair.brief.approval_hash,
  });
  expect(first.id).toBe(approvedRepair.brief.id);
  expect(retry.id).toBe(approvedRepair.brief.id);
  expect(first.parent_run_id).toBe(parentId);
  await expect(
    startConstruct({
      action: 'start',
      projectId: state.projectId,
      briefId: approvedRepair.brief.id,
      requestId: '00000000-0000-4000-8000-0000000000a6',
      expected: 1,
      approvalHash: approvedRepair.brief.approval_hash,
    }),
  ).rejects.toThrow(/brief identity|reuse the approved/i);
  const repairRun = (
    constructStore() as unknown as { runs: Map<string, { status: string; result: unknown; parent_run_id?: string }> }
  ).runs.get(approvedRepair.brief.id)!;
  repairRun.status = 'failed';
  repairRun.result = stored.result;
  await expect(
    proposeRepairConstruct(
      { action: 'propose-repair', projectId: state.projectId, parentRunId: approvedRepair.brief.id },
      new AbortController().signal,
    ),
  ).rejects.toThrow(/already a repair|one repair/i);
  state.revision = 2;
  await expect(
    proposeRepairConstruct(
      { action: 'propose-repair', projectId: state.projectId, parentRunId: parentId },
      new AbortController().signal,
    ),
  ).rejects.toThrow(/revision 1|newer revision|silently/i);
});

async function failedParentForRecovery() {
  vi.stubEnv('ARCHITECT_CONSTRUCT_AI_MOCK', 'true');
  vi.stubEnv('APP_ENV', 'local');
  vi.stubEnv('NODE_ENV', 'development');
  const files = [{ path: 'ok.mjs', content: 'export const heading = "Before";\n' }];
  const failed = 'export const heading = "After"\nconst introduced = ;\n';
  const approved = await approveConstructChange({
    action: 'approve-change',
    projectId: state.projectId,
    briefId: '00000000-0000-4000-8000-0000000000b1',
    sourceId: '00000000-0000-4000-8000-0000000000b2',
    expected: 1,
    sourceKind: 'imported',
    repository: null,
    commit: null,
    files,
    intendedChange: 'Introduce the labelled syntax fixture.',
    allowedPaths: ['ok.mjs'],
    protectedPaths: defaultProtectedPaths(),
    acceptanceChecks: [{ name: 'syntax:ok.mjs', command: 'node', args: ['--check', 'ok.mjs'] }],
    patch: [{ path: 'ok.mjs', before: files[0]!.content, after: failed }],
  });
  const parentId = '00000000-0000-4000-8000-0000000000b3';
  await startConstruct({
    action: 'start',
    projectId: state.projectId,
    briefId: approved.brief.id,
    requestId: parentId,
    expected: 1,
    approvalHash: approved.brief.approval_hash,
  });
  const stored = (
    constructStore() as unknown as { runs: Map<string, { status: string; result: unknown }> }
  ).runs.get(parentId)!;
  stored.status = 'failed';
  stored.result = {
    isolation: 'process-fixture',
    runtime_available: false,
    sandbox: false,
    blocker: 'Introduced syntax failure.',
    source_hash: approved.source.tree_hash,
    result_hash: null,
    changed_files: ['ok.mjs'],
    diff: '',
    checks: [
      {
        name: 'syntax:ok.mjs',
        command: 'node --check ok.mjs',
        exit_code: 1,
        status: 'failed',
        log: 'SyntaxError',
      },
    ],
    coverage: {
      no_applicable: false,
      preexisting_failures: [],
      introduced_failures: ['syntax:node --check ok.mjs:ok.mjs'],
      untested: [],
      unsupported: [{ kind: 'typecheck', reason: 'Unsupported in this sandbox.' }],
      revision_note: '1',
    },
    preview: { path: null, body: '', unavailable_reason: 'none' },
    artifacts: [],
  };
  const proposed = await proposeRepairConstruct(
    { action: 'propose-repair', projectId: state.projectId, parentRunId: parentId },
    new AbortController().signal,
  );
  return { parentId, proposed, failed };
}

it('recovers an approved unstarted repair through read, then starts once after a lost response', async () => {
  const { parentId, proposed } = await failedParentForRecovery();
  const approvedRepair = await approveRepairConstruct({
    action: 'approve-repair',
    projectId: state.projectId,
    briefId: '00000000-0000-4000-8000-0000000000b4',
    parentRunId: parentId,
    expected: 1,
    patch: proposed.proposal.patch,
    generation: { mode: 'mock', notes: 'Labelled demonstration. Not a paid OpenAI call.' },
  });
  const beforeStart = await readConstruct(state.projectId);
  expect(beforeStart.pendingRepair?.briefId).toBe(approvedRepair.brief.id);
  expect(beforeStart.pendingRepair?.requestId).toBe(approvedRepair.brief.id);
  expect(beforeStart.pendingRepair?.approvalHash).toBe(approvedRepair.brief.approval_hash);
  expect(beforeStart.pendingRepair?.status).toBe('approved');
  expect(beforeStart.pendingRepair?.generation.mode).toBe('mock');
  expect(beforeStart.pendingRepair?.generation.notes).toMatch(/demonstration/i);
  expect(beforeStart.pendingRepair?.patch[0]?.after).toBe(proposed.combined[0]?.after);
  expect(beforeStart.runs.some((run) => run.parent_run_id === parentId)).toBe(false);
  const recovered = beforeStart.pendingRepair;
  if (!recovered) throw new Error('expected recovered approved repair');
  const first = await startConstruct({
    action: 'start',
    projectId: state.projectId,
    briefId: recovered.briefId,
    requestId: recovered.requestId,
    expected: 1,
    approvalHash: recovered.approvalHash,
  });
  const lostResponseRetry = await startConstruct({
    action: 'start',
    projectId: state.projectId,
    briefId: recovered.briefId,
    requestId: recovered.requestId,
    expected: 1,
    approvalHash: recovered.approvalHash,
  });
  expect(first.id).toBe(recovered.requestId);
  expect(lostResponseRetry.id).toBe(first.id);
  expect(first.parent_run_id).toBe(parentId);
  const children = [...(constructStore() as unknown as { runs: Map<string, { parent_run_id?: string }> }).runs.values()].filter(
    (run) => run.parent_run_id === parentId,
  );
  expect(children).toHaveLength(1);
  const after = await readConstruct(state.projectId);
  expect(after.pendingRepair).toBeNull();
  expect(after.runs.some((run) => run.id === first.id && run.parent_run_id === parentId)).toBe(true);
});

it('restores unknown provenance and refuses a revoked recovered approval', async () => {
  const { parentId, proposed } = await failedParentForRecovery();
  const approvedRepair = await approveRepairConstruct({
    action: 'approve-repair',
    projectId: state.projectId,
    briefId: '00000000-0000-4000-8000-0000000000b5',
    parentRunId: parentId,
    expected: 1,
    patch: proposed.proposal.patch,
  });
  const loaded = await readConstruct(state.projectId);
  expect(loaded.pendingRepair?.generation.mode).toBe('unknown');
  expect(loaded.pendingRepair?.generation.notes).toBeUndefined();
  await constructStore().invalidateProjectBriefs(
    state.owner,
    state.projectId,
    'Founder revoked this approval.',
  );
  const revoked = await readConstruct(state.projectId);
  expect(revoked.pendingRepair?.status).toBe('invalidated');
  expect(revoked.pendingRepair?.invalidationReason).toMatch(/revoked/i);
  await expect(
    startConstruct({
      action: 'start',
      projectId: state.projectId,
      briefId: approvedRepair.brief.id,
      requestId: approvedRepair.brief.id,
      expected: 1,
      approvalHash: approvedRepair.brief.approval_hash,
    }),
  ).rejects.toThrow(/revoked|invalidated/i);
});
