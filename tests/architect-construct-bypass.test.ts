import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { fixtureScope, fixtureSource } from '@/domains/architect-construct/fixture';
import { treeHash } from '@/domains/architect-construct/hash';
import { executeConstruct, TRUSTED_IN_PROCESS } from '@/domains/architect-construct/runner';
import { MemoryConstructStore } from '@/domains/architect-construct/store';
import { processConstructOnce } from '@/domains/architect-construct/worker';

const owner = '00000000-0000-4000-8000-000000000001';
const project = '00000000-0000-4000-8000-000000000003';
const requestId = '00000000-0000-4000-8000-000000000071';

it('does not execute owner-supplied check.mjs on the worker host', async () => {
  const marker = join(tmpdir(), `construct-host-marker-${requestId}`);
  const files = [
    { path: 'README.md', content: 'owner tree\n' },
    { path: 'preview.html', content: '<h1>Before</h1>\n' },
    {
      path: 'check.mjs',
      content: `import { writeFileSync } from 'node:fs';\nwriteFileSync(${JSON.stringify(marker)}, 'host-executed');\n`,
    },
  ];
  const source = {
    ...fixtureSource(owner, requestId),
    kind: 'fixture' as const,
    files,
    tree_hash: treeHash(files),
  };
  const scope = fixtureScope({
    projectId: project,
    projectRevision: 1,
    sourceId: source.id,
    sourceTreeHash: source.tree_hash,
  });
  scope.acceptance_checks = [{ name: 'heading', command: 'node', args: ['check.mjs'] }];
  const store = new MemoryConstructStore();
  await store.importSource(source);
  await store.approveBrief(owner, requestId, scope);
  await store.startRun({
    personId: owner,
    projectId: project,
    briefId: requestId,
    requestId,
    expected: 1,
    sourceKind: source.kind,
    sourceTreeHash: source.tree_hash,
    approvalHash: (await store.readBrief(owner, requestId))!.approval_hash,
    sourceId: source.id,
  });
  const isolated = await executeConstruct(
    { source, scope, previewPath: 'preview.html' },
    {
      probe: async () => ({
        available: false,
        backend: 'unavailable',
        code: 'not-installed',
        reason: 'Isolation unavailable. Host execution is not a fallback.',
      }),
    },
  );
  const trusted = await executeConstruct(
    { source, scope, previewPath: 'preview.html' },
    { trustedInProcess: TRUSTED_IN_PROCESS },
  );
  const worker = await processConstructOnce(store, 'hostile-worker', new Date(), {
    probe: async () => ({
      available: false,
      backend: 'unavailable',
      code: 'not-installed',
      reason: 'Isolation unavailable. Host execution is not a fallback.',
    }),
  });
  expect(isolated.isolation).toBe('unavailable');
  expect(trusted.isolation).toBe('unavailable');
  expect(worker?.result?.isolation).toBe('unavailable');
  expect(existsSync(marker)).toBe(false);
}, 120000);
