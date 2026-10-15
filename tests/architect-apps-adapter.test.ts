import { afterEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { generateAppProposal } from '@/domains/architect-apps/generation';
import { defaultAppGenerationTransport, mockedSupportedAppProposal } from '@/domains/architect-apps/provider';
import { notesBrokenTypecheckOperations, notesCollections, notesProposal, notesSourceFiles } from '@/domains/architect-apps/notes-fixture';
import { applyFileOperations, overlaySealedFiles } from '@/domains/architect-apps/tree';
import { isGeneratedAppPath, isSealedAppPath } from '@/domains/architect-apps/catalog';
import { allowlistedAppDataPayload } from '@/domains/architect-apps/allowlist';
import { signPreviewSession, verifyPreviewSession, resetPreviewSessions, previewCsp, previewClusterAllowed } from '@/domains/architect-apps/preview';
import { PREVIEW_SESSION_MAX } from '@/domains/architect-apps/schema';
import { buildAppGenerationContext, APP_DATA_BRIDGE_CONTRACT } from '@/domains/architect-apps/context';
import { fileHash } from '@/domains/architect-apps/hash';

afterEach(() => {
  vi.unstubAllEnvs();
  resetPreviewSessions();
});

it('uses the production adapter with deterministic transport for a non-tracker app and a non-prewritten revision', async () => {
  const created = mockedSupportedAppProposal({ kind: 'create', files: [] });
  expect(created.notes).toMatch(/not the tracker fixture/i);
  expect(created.files.length).toBeGreaterThan(6);
  expect(created.files.every((file) => file.path.startsWith('src/'))).toBe(true);
  const transport = async (input: { kind: 'create' | 'revise'; files: { path: string; content: string; hash: string }[] }) => {
    expect(input.files.every((file) => file.hash === fileHash(file.content))).toBe(true);
    expect(input.files.some((file) => file.content.includes('export'))).toBe(input.kind === 'revise');
    return mockedSupportedAppProposal(input);
  };
  const generated = await generateAppProposal(
    {
      instruction: 'Create field notes I can save and filter.',
      kind: 'create',
      demo: 'none',
      baseFiles: [],
      brief: 'A private field notebook.',
    },
    transport,
    { ARCHITECT_ORIGIN_ENABLED: 'true', ARCHITECT_APPS_ENABLED: 'true', ARCHITECT_APPS_AI_MOCK: 'true', APP_ENV: 'local' },
  );
  expect(generated.mode).toBe('mock');
  expect(generated.proposal.summary).toMatch(/field notes/i);
  const revised = await generateAppProposal(
    {
      instruction: 'Add an optional tag.',
      kind: 'revise',
      demo: 'none',
      baseFiles: overlaySealedFiles(generated.proposal.files),
    },
    transport,
    { ARCHITECT_ORIGIN_ENABLED: 'true', ARCHITECT_APPS_ENABLED: 'true', ARCHITECT_APPS_AI_MOCK: 'true', APP_ENV: 'local' },
  );
  expect(revised.proposal.operations?.some((operation) => operation.path === 'src/types.ts')).toBe(true);
  expect(revised.proposal.files.find((file) => file.path === 'src/calc.ts')?.content).toBe(
    notesProposal().files.find((file) => file.path === 'src/calc.ts')?.content,
  );
  expect(() =>
    applyFileOperations(notesSourceFiles(), [
      { op: 'update', path: 'package.json', content: '{}', baseHash: 'a'.repeat(64) },
    ]),
  ).toThrow(/sealed toolchain/i);
  expect(generated.proposal.files.every((file) => isGeneratedAppPath(file.path) && !isSealedAppPath(file.path))).toBe(true);
  expect(defaultAppGenerationTransport({ ARCHITECT_APPS_ENABLED: 'true' })).toBeUndefined();
});

it('labels the tracker as a fixture and refuses OpenAI without a wired transport', async () => {
  const tracker = await generateAppProposal(
    { instruction: 'tracker', kind: 'create', demo: 'tracker', baseFiles: [] },
    undefined,
    { ARCHITECT_ORIGIN_ENABLED: 'true', ARCHITECT_APPS_ENABLED: 'true', ARCHITECT_APPS_FIXTURE: 'true', APP_ENV: 'local' },
  );
  expect(tracker.mode).toBe('fixture');
  await expect(
    generateAppProposal(
      { instruction: 'notes', kind: 'create', demo: 'none', baseFiles: [] },
      undefined,
      { ARCHITECT_ORIGIN_ENABLED: 'true', ARCHITECT_APPS_ENABLED: 'true', ARCHITECT_APPS_AI_ENABLED: 'true', OPENAI_API_KEY: 'sk-test', APP_ENV: 'local' },
    ),
  ).rejects.toThrow(/provider adapter was not wired/i);
});

it('supplies authoritative source contents, hashes, collections and the host bridge', () => {
  const files = notesProposal().files;
  const context = buildAppGenerationContext({
    instruction: 'Add a tag.',
    kind: 'revise',
    files,
    collections: notesCollections,
    brief: 'Keep field notes.',
    direction: { schema: 'talk-architect-direction/v1', summary: 'Field notes', digest: 'a'.repeat(64), verified: false },
  });
  expect(context.files[0]?.content.length).toBeGreaterThan(0);
  expect(context.files[0]?.hash).toMatch(/^[0-9a-f]{64}$/);
  expect(context.collections).toEqual(notesCollections);
  expect(context.bridge).toEqual(APP_DATA_BRIDGE_CONTRACT);
  expect(context.bridge.replay.changedPayload).toMatch(/mutation identity/i);
  expect(context.bridge.examples.update.expectedVersion).toBe(1);
  expect(context.brief).toMatch(/field notes/i);
  expect(context.direction?.schema).toBe('talk-architect-direction/v1');
  expect(context.direction?.unsupported?.length).toBeGreaterThan(0);
});

it('derives compact preview sessions and allowlists iframe payloads', async () => {
  resetPreviewSessions();
  const session = await signPreviewSession({
    personId: '00000000-0000-4000-8000-000000000001',
    projectId: '00000000-0000-4000-8000-000000000003',
    revisionId: '00000000-0000-4000-8000-000000000009',
    secret: 'unit-preview-secret-key',
  });
  expect(session.split('.')).toHaveLength(4);
  expect(previewCsp()).toMatch(/sandbox allow-scripts/);
  expect(previewCsp()).not.toMatch(/allow-same-origin/);
  expect(session.length).toBeLessThanOrEqual(PREVIEW_SESSION_MAX);
  expect(
    await verifyPreviewSession(session, {
      personId: '00000000-0000-4000-8000-000000000001',
      projectId: '00000000-0000-4000-8000-000000000003',
      revisionId: '00000000-0000-4000-8000-000000000009',
    }, 'unit-preview-secret-key'),
  ).toBe(true);
  const replaced = await signPreviewSession({
    personId: '00000000-0000-4000-8000-000000000001',
    projectId: '00000000-0000-4000-8000-000000000003',
    revisionId: '00000000-0000-4000-8000-000000000009',
    secret: 'unit-preview-secret-key',
    replace: true,
  });
  expect(
    await verifyPreviewSession(session, {
      personId: '00000000-0000-4000-8000-000000000001',
      projectId: '00000000-0000-4000-8000-000000000003',
      revisionId: '00000000-0000-4000-8000-000000000009',
    }, 'unit-preview-secret-key'),
  ).toBe(false);
  expect(
    await verifyPreviewSession(replaced, {
      personId: '00000000-0000-4000-8000-000000000001',
      projectId: '00000000-0000-4000-8000-000000000003',
      revisionId: '00000000-0000-4000-8000-000000000009',
    }, 'unit-preview-secret-key'),
  ).toBe(true);
  const trusted = {
    projectId: '00000000-0000-4000-8000-000000000003',
    revisionId: '00000000-0000-4000-8000-000000000009',
  };
  const allowlisted = allowlistedAppDataPayload(
    {
      schema: 'architect-apps-data/v1',
      session,
      requestId: '00000000-0000-4000-8000-000000000441',
      operation: 'create',
      collection: 'notes',
      payload: { title: 'Site visit' },
      projectId: '00000000-0000-4000-8000-000000000099',
      revisionId: '00000000-0000-4000-8000-000000000098',
      action: 'approve',
    },
    trusted,
  );
  expect(allowlisted.projectId).toBe(trusted.projectId);
  expect(allowlisted.revisionId).toBe(trusted.revisionId);
  expect(allowlisted.action).toBe('data');
});

it('labels a compile-failure revision and refuses HMAC-only preview after restart even when cluster mode is on', async () => {
  const created = mockedSupportedAppProposal({ kind: 'create', files: [] });
  const broken = mockedSupportedAppProposal({
    kind: 'revise',
    files: created.files,
    instruction: 'Break the isolated typecheck so the last good preview stays.',
  });
  expect(broken.notes).toMatch(/compile-failure fixture/i);
  expect(broken.files.find((file) => file.path === 'src/App.tsx')?.content).toMatch(/not-a-number/);
  expect(notesBrokenTypecheckOperations(created.files)[0]?.path).toBe('src/App.tsx');
  resetPreviewSessions();
  const session = await signPreviewSession({
    personId: '00000000-0000-4000-8000-000000000001',
    projectId: '00000000-0000-4000-8000-000000000003',
    revisionId: '00000000-0000-4000-8000-000000000009',
    secret: 'unit-preview-secret-key',
  });
  resetPreviewSessions();
  expect(
    await verifyPreviewSession(
      session,
      {
        personId: '00000000-0000-4000-8000-000000000001',
        projectId: '00000000-0000-4000-8000-000000000003',
        revisionId: '00000000-0000-4000-8000-000000000009',
      },
      'unit-preview-secret-key',
    ),
  ).toBe(false);
  vi.stubEnv('ARCHITECT_APPS_PREVIEW_CLUSTER', 'true');
  vi.stubEnv('ARCHITECT_APPS_PREVIEW_SECRET', 'unit-preview-secret-key');
  vi.stubEnv('APP_ENV', 'production');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'hosted-publishable-key');
  expect(previewClusterAllowed()).toBe(true);
  expect(
    await verifyPreviewSession(
      session,
      {
        personId: '00000000-0000-4000-8000-000000000001',
        projectId: '00000000-0000-4000-8000-000000000003',
        revisionId: '00000000-0000-4000-8000-000000000009',
      },
      'unit-preview-secret-key',
    ),
  ).toBe(false);
});


it('scoped visual fixture changes only the verified heading and retains data contracts', () => {
  const created = mockedSupportedAppProposal({ kind: 'create', files: [] });
  const revised = mockedSupportedAppProposal({ kind: 'revise', files: created.files, collections: created.collections, instruction: 'Use a warm gold heading' });
  expect(revised.collections).toEqual(created.collections);
  expect(revised.behaviors).toEqual(created.behaviors);
  expect(revised.operations).toHaveLength(1);
  expect(revised.operations?.[0]?.path).toBe('src/App.tsx');
  const before = created.files.find((file) => file.path === 'src/App.tsx')!.content;
  const after = revised.files.find((file) => file.path === 'src/App.tsx')!.content;
  expect(after.replace(' style={{ color: "#e8c980", letterSpacing: "0.03em" }}', '')).toBe(before);
});
