import { mkdir, writeFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { fixtureScope, fixtureSource } from '@/domains/architect-construct/fixture';
import {
  executeConstruct,
  removeNamedContainer,
  spawnDocker,
} from '@/domains/architect-construct/runner';
import { ensureConstructImage, probeDockerIsolation } from '@/domains/architect-construct/docker';

it('inspects the host isolation runtime and reports pass, fail, or unavailable honestly', async () => {
  const owner = '00000000-0000-4000-8000-000000000001';
  const source = fixtureSource(owner, '00000000-0000-4000-8000-000000000051');
  const scope = fixtureScope({
    projectId: '00000000-0000-4000-8000-000000000003',
    projectRevision: 1,
    sourceId: source.id,
    sourceTreeHash: source.tree_hash,
  });
  const probe = await probeDockerIsolation();
  const image = probe.available ? await ensureConstructImage(probe.image) : { ready: false, reason: probe.reason, pulled: false };
  let outcome: 'passed' | 'failed' | 'unavailable' = 'unavailable';
  let execution: Awaited<ReturnType<typeof executeConstruct>> | null = null;
  if (probe.available && image.ready) {
    execution = await executeConstruct(
      { source: { ...source, kind: 'imported' }, scope, previewPath: 'preview.html' },
      {
        probe: async () => probe,
        requireIsolation: true,
        ensureImage: async () => image,
      },
    );
    outcome = execution.sandbox && execution.isolation === 'docker' ? 'passed' : 'failed';
  } else if (probe.available && !image.ready) {
    outcome = 'unavailable';
  }
  const receipt = {
    label: 'Host isolation integration — not a model-generated Aethelios feature.',
    probe,
    image,
    outcome,
    execution: execution && {
      isolation: execution.isolation,
      runtime_available: execution.runtime_available,
      sandbox: execution.sandbox,
      blocker: execution.blocker,
      checks: execution.checks.map((check) => ({
        name: check.name,
        status: check.status,
        exit_code: check.exit_code,
      })),
      artifact_hashes: execution.artifacts,
      cleanup: execution.artifacts.some((item) => String(item.ref).startsWith('cleanup-removed:')),
      preview_contains_after: execution.preview.body.includes('<h1>After</h1>'),
    },
  };
  await mkdir('docs/evidence/architect-construct', { recursive: true });
  await writeFile(
    'docs/evidence/architect-construct/host-isolation-receipt.json',
    JSON.stringify(receipt, null, 2) + '\n',
  );
  expect(['passed', 'failed', 'unavailable']).toContain(outcome);
  if (outcome === 'unavailable') {
    expect(probe.available === false || image.ready === false).toBe(true);
  }
  if (outcome === 'passed') {
    expect(execution?.sandbox).toBe(true);
    expect(execution?.isolation).toBe('docker');
    expect(execution?.preview.body).toContain('<h1>After</h1>');
    expect(execution?.artifacts.some((item) => String(item.ref).startsWith('cleanup-removed:'))).toBe(true);
  }
  if (outcome === 'failed') {
    expect(execution?.sandbox, execution?.blocker ?? 'isolated container failed').toBe(true);
  }
});

it('stops an active named container when abort is observed, or records Docker as unavailable', async () => {
  const probe = await probeDockerIsolation();
  const name = `construct-abort-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  let launched: Awaited<ReturnType<typeof spawnDocker>> | null = null;
  let gone = false;
  if (probe.available) {
    let aborted = false;
    setTimeout(() => {
      aborted = true;
    }, 150);
    launched = await spawnDocker(
      ['run', '--rm', '--name', name, '--network', 'none', 'node:24-alpine', 'sleep', '30'],
      8000,
      () => aborted,
    );
    gone = await removeNamedContainer(name);
  }
  const receipt = {
    label: 'Host active-cancel — not a model-generated Aethelios feature.',
    available: probe.available,
    exit_code: launched?.exit_code ?? null,
    aborted: launched?.aborted ?? false,
    stopped: launched?.stopped ?? false,
    container_gone: gone,
    reason: probe.available ? null : probe.reason,
  };
  await mkdir('docs/evidence/architect-construct', { recursive: true });
  await writeFile(
    'docs/evidence/architect-construct/host-active-cancel-receipt.json',
    JSON.stringify(receipt, null, 2) + '\n',
  );
  if (!probe.available) {
    expect(probe.available).toBe(false);
    return;
  }
  expect(launched?.aborted).toBe(true);
  expect(launched?.stopped).toBe(true);
  expect(gone).toBe(true);
});
