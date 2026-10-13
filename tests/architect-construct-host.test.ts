import { mkdir, writeFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { fixtureScope, fixtureSource } from '@/domains/architect-construct/fixture';
import {
  containerNameFromArgs,
  executeConstruct,
  inspectNamedContainer,
  removeNamedContainer,
  spawnDocker,
  type ContainerLaunchResult,
  type ContainerPresence,
} from '@/domains/architect-construct/runner';
import { ensureConstructImage, probeDockerIsolation } from '@/domains/architect-construct/docker';
import { MemoryConstructStore } from '@/domains/architect-construct/store';
import { processConstructOnce } from '@/domains/architect-construct/worker';

const owner = '00000000-0000-4000-8000-000000000001';
const project = '00000000-0000-4000-8000-000000000003';

it('inspects the host isolation runtime and reports pass, fail, or unavailable honestly', async () => {
  const source = fixtureSource(owner, '00000000-0000-4000-8000-000000000051');
  const scope = fixtureScope({
    projectId: project,
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

it('cancels only after the named container is observed running, then confirms removal', async () => {
  const probe = await probeDockerIsolation();
  const requestId = '00000000-0000-4000-8000-000000000052';
  const nameHint = `construct-live-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const observed: {
    running: boolean;
    name: string | null;
    launched: ContainerLaunchResult | null;
    after: ContainerPresence | null;
    durable: Awaited<ReturnType<typeof processConstructOnce>> | null;
  } = { running: false, name: null, launched: null, after: null, durable: null };
  const image = probe.available
    ? await ensureConstructImage(probe.image)
    : { ready: false, reason: probe.reason, pulled: false };
  if (probe.available && image.ready) {
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
    observed.durable = await processConstructOnce(store, 'host-running-cancel', new Date(), {
      probe: async () => probe,
      requireIsolation: true,
      ensureImage: async () => ({ ready: true, reason: null, pulled: false }),
      launchContainer: async (args, timeoutMs, shouldAbort) => {
        const name = containerNameFromArgs(args) ?? nameHint;
        observed.name = name;
        let stop = false;
        const running = spawnDocker(
          ['run', '--rm', '--name', name, '--network', 'none', 'node:24-alpine', 'sleep', '30'],
          timeoutMs,
          () => stop || Boolean(shouldAbort?.()),
        );
        const deadline = Date.now() + 8000;
        while (Date.now() < deadline && !observed.running) {
          const presence = await inspectNamedContainer(name);
          if (presence.status === 'present' && presence.running) {
            observed.running = true;
            await store.cancelRun(owner, requestId);
            stop = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        observed.launched = await running;
        observed.after = await inspectNamedContainer(name);
        return observed.launched;
      },
    });
  }
  const gone =
    observed.after?.status === 'absent' ||
    (observed.name ? await removeNamedContainer(observed.name) : false);
  const receipt = {
    label: 'Host running-container cancel — not a model-generated Aethelios feature.',
    available: probe.available,
    observed_running: observed.running,
    container: observed.name,
    after_inspect: observed.after,
    exit_code: observed.launched?.exit_code ?? null,
    aborted: observed.launched?.aborted ?? false,
    stopped: observed.launched?.stopped ?? false,
    container_gone: gone,
    durable_status: observed.durable?.status ?? null,
    durable_blocker: observed.durable?.result?.blocker ?? null,
    teardown_confirmed:
      observed.durable?.result?.artifacts.some((item) => item.ref === 'teardown-confirmed') ?? false,
    reason: probe.available && image.ready ? null : image.reason ?? probe.reason,
  };
  await mkdir('docs/evidence/architect-construct', { recursive: true });
  await writeFile(
    'docs/evidence/architect-construct/host-active-cancel-receipt.json',
    JSON.stringify(receipt, null, 2) + '\n',
  );
  if (!probe.available || !image.ready) {
    expect(probe.available && image.ready).toBe(false);
    expect(observed.running).toBe(false);
    return;
  }
  expect(observed.running).toBe(true);
  expect(observed.launched?.aborted).toBe(true);
  expect(observed.launched?.stopped).toBe(true);
  expect(observed.after?.status).toBe('absent');
  expect(gone).toBe(true);
  expect(observed.durable?.status).toBe('cancelled');
  expect(observed.durable?.result?.sandbox).toBe(false);
  expect(observed.durable?.result?.artifacts.some((item) => item.ref === 'teardown-confirmed')).toBe(
    true,
  );
});
