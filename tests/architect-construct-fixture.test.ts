import { mkdir, writeFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { fixturePreviewPath, fixtureScope, fixtureSource } from '@/domains/architect-construct/fixture';
import { MemoryConstructStore } from '@/domains/architect-construct/store';
import { processConstructOnce } from '@/domains/architect-construct/worker';
import { executeInProcess } from '@/domains/architect-construct/runner';

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
  const executed = await executeInProcess({
    source,
    scope: brief.scope,
    previewPath: fixturePreviewPath,
  });
  const worker = await processConstructOnce(store, 'fixture-worker', new Date(), {
    probe: async () => ({
      available: false,
      backend: 'unavailable',
      code: 'not-installed',
      reason: 'Worker path must not fall back to host execution.',
    }),
  });
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
      id: requestId,
      status: executed.checks.every((check) => check.status === 'passed') ? 'succeeded' : 'failed',
      events: (await store.listEvents(owner, requestId)).map((event) => event.kind),
      changed_files: executed.changed_files,
      checks: executed.checks.map((check) => ({
        name: check.name,
        status: check.status,
        exit_code: check.exit_code,
      })),
      preview_contains_after: executed.preview.body.includes('<h1>After</h1>'),
      isolation: executed.isolation,
      runtime_available: executed.runtime_available,
      sandbox: executed.sandbox,
      worker_isolation: worker?.result?.isolation ?? null,
    },
  };
  await mkdir('docs/evidence/architect-construct', { recursive: true });
  await writeFile(
    'docs/evidence/architect-construct/fixture-receipt.json',
    JSON.stringify(receipt, null, 2) + '\n',
  );
  expect(executed.isolation).toBe('process-fixture');
  expect(executed.runtime_available).toBe(false);
  expect(executed.sandbox).toBe(false);
  expect(executed.preview.body).toContain('<h1>After</h1>');
  expect(worker?.status).toBe('blocked');
  expect(worker?.result?.isolation).toBe('unavailable');
  expect(worker?.result?.sandbox).toBe(false);
});
