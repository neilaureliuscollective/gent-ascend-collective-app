import { mkdir, writeFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { fixturePreviewPath, fixtureSource } from '@/domains/architect-construct/fixture';
import { MemoryConstructStore } from '@/domains/architect-construct/store';
import { processConstructOnce } from '@/domains/architect-construct/worker';
import { fixtureScope } from '@/domains/architect-construct/fixture';

const owner = '00000000-0000-4000-8000-000000000001';
const project = '00000000-0000-4000-8000-000000000003';
const requestId = '00000000-0000-4000-8000-000000000041';

it('records a durable labelled fixture receipt through prepare-patch-check-preview-reload', async () => {
  const store = new MemoryConstructStore();
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
  const executed = await processConstructOnce(store, 'fixture-worker');
  const reloaded = await store.readRun(owner, requestId);
  const receipt = {
    label: 'Deterministic Architect construct fixture — execution mechanics, not a model-generated Aethelios feature.',
    candidate: 'Find and resume Architect projects remains a future model-generated candidate and was not prewritten.',
    source: {
      kind: source.kind,
      label: source.label,
      tree_hash: source.tree_hash,
      preview: fixturePreviewPath,
    },
    run: {
      id: reloaded?.id,
      status: reloaded?.status,
      events: (await store.listEvents(owner, requestId)).map((event) => event.kind),
      changed_files: reloaded?.result?.changed_files,
      checks: reloaded?.result?.checks.map((check) => ({
        name: check.name,
        status: check.status,
        exit_code: check.exit_code,
      })),
      preview_contains_after: reloaded?.result?.preview.body.includes('<h1>After</h1>'),
      isolation: reloaded?.result?.isolation,
      runtime_available: reloaded?.result?.runtime_available,
      sandbox: reloaded?.result?.sandbox,
    },
  };
  await mkdir('docs/evidence/architect-construct', { recursive: true });
  await writeFile(
    'docs/evidence/architect-construct/fixture-receipt.json',
    JSON.stringify(receipt, null, 2) + '\n',
  );
  expect(executed?.status).toBe('succeeded');
  expect(reloaded?.result?.preview.body).toContain('<h1>After</h1>');
  expect(reloaded?.result?.isolation).toBe('process-fixture');
  expect(reloaded?.result?.runtime_available).toBe(false);
  expect(reloaded?.result?.sandbox).toBe(false);
});
