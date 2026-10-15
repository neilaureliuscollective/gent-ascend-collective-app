import { expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  appsDockerInvocation,
  appsWorkRoot,
  assertHostVisibleWorkPath,
  assertSafeAppsDockerArgs,
  buildIsolatedGeneratedApp,
  collectArtifactTree,
  defaultAppsImage,
  isolatedArtifactCollectorModule,
  parseAppsContainerResult,
  parseAppsImageDigest,
  parseAppsToolchainVersions,
  probeAppsDockerIsolation,
  removeNamedAppsContainer,
  trustedAppsContainerRunner,
  appsNobody,
} from '@/domains/architect-apps/isolate';
import {
  assertPackagedWorkerIsolation,
  packagedWorkerInvocation,
  packagedWorkerTopologyArgs,
  provePackagedWorkerTopology,
} from '../scripts/architect-apps-packaged-worker.mjs';
import { acceptAppBuildSuccess, resolveAppExecutionKind } from '@/domains/architect-apps/worker';
import { notesSourceFiles } from '@/domains/architect-apps/notes-fixture';

it('builds a non-root isolated Docker invocation without host credentials or socket', () => {
  const invocation = appsDockerInvocation('/tmp/apps-src', '/tmp/apps-runner.mjs', 'aethelios-architect-apps:2026-10-15.1', {
    jobFile: '/tmp/apps-job.json',
    name: 'apps-unit',
  });
  expect(parseAppsImageDigest(`sha256:${'ab'.repeat(32)}`)).toMatch(/^sha256:[a-f0-9]{64}$/);
  expect(parseAppsImageDigest('latest')).toBeNull();
  expect(invocation.command).toBe('docker');
  expect(invocation.args).toContain('--network');
  expect(invocation.args[invocation.args.indexOf('--network') + 1]).toBe('none');
  expect(invocation.args[invocation.args.indexOf('--user') + 1]).toBe(appsNobody);
  expect(invocation.args.join(' ')).not.toMatch(/docker\.sock|privileged|OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY/);
  expect(() => assertSafeAppsDockerArgs(invocation.args)).not.toThrow();
  expect(() =>
    assertSafeAppsDockerArgs(['run', '--network', 'none', '--user', appsNobody, '--tmpfs', '/work:uid=65534,gid=65534', '-v', '/var/run/docker.sock:/var/run/docker.sock']),
  ).toThrow(/host authority or secrets/i);
});

it('accepts only docker sandbox success for normal apps and keeps host-fixture fixture-only', () => {
  expect(
    acceptAppBuildSuccess(
      {
        ok: true,
        isolation: 'docker',
        sandbox: true,
        typecheck: { ok: true, log: '' },
        bundle: { ok: true, log: '' },
        blocker: null,
        stages: [],
      },
      { mode: 'mock' },
    ),
  ).toBe('isolated');
  expect(
    acceptAppBuildSuccess(
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
    ),
  ).toBe('reject');
  expect(
    acceptAppBuildSuccess(
      {
        ok: true,
        isolation: 'host-fixture',
        sandbox: false,
        typecheck: { ok: true, log: '' },
        bundle: { ok: true, log: '' },
        blocker: null,
        stages: [],
      },
      { mode: 'fixture' },
    ),
  ).toBe('host-fixture');
  expect(resolveAppExecutionKind({ mode: 'mock' })).toBe('docker');
  expect(resolveAppExecutionKind({ mode: 'fixture' }, { ARCHITECT_APPS_ALLOW_HOST_FIXTURE: 'true' })).toBe('host-fixture');
});

it('runs the production isolated adapter through deterministic injected transport', async () => {
  const fenced = [
    'APPS_RESULT_BEGIN',
    JSON.stringify({
      ok: true,
      isolation: 'docker',
      sandbox: true,
      versions: { typescript: '6.0.3', vite: '8.3.0', react: '19.3.0' },
      typecheck: { ok: true, log: 'ok' },
      bundle: { ok: true, log: 'ok' },
      artifacts: [
        {
          path: 'index.html',
          content: '<!doctype html><html><head></head><body><div id="root"></div><script type="module" src="./assets/app.js"></script></body></html>',
        },
        { path: 'assets/app.js', content: 'document.getElementById("root").textContent="Field notes";' },
      ],
    }),
    'APPS_RESULT_END',
  ].join('\n');
  expect(parseAppsToolchainVersions(JSON.stringify({ typescript: '6.0.3', vite: '8.3.0', react: '19.3.0' })).ok).toBe(true);
  expect(parseAppsToolchainVersions(JSON.stringify({ typescript: '5.0.0', vite: '8.3.0', react: '19.3.0' })).ok).toBe(false);
  expect(parseAppsContainerResult(fenced)?.sandbox).toBe(true);
  const commands: string[][] = [];
  const built = await buildIsolatedGeneratedApp(notesSourceFiles(), {
    exec: async (_file, args) => {
      commands.push([...args]);
      if (args[0] === 'version') return { stdout: '28.0.1\n' };
      if (args[0] === 'rm') return { stdout: '' };
      if (args[0] === 'inspect') {
        const error = new Error('Error: No such container: apps-unit');
        throw error;
      }
      assertSafeAppsDockerArgs([...args]);
      expect(args).toContain('--network');
      expect(args).toContain('--name');
      return { stdout: fenced, stderr: 'APPS_WORKSPACE {"identity":{"uid":65534,"gid":65534}}' };
    },
    env: { PATH: '/usr/bin', ARCHITECT_APPS_IMAGE: 'aethelios-architect-apps:2026-10-15.1' },
    name: 'apps-unit',
  });
  expect(built.result.isolation).toBe('docker');
  expect(built.result.sandbox).toBe(true);
  expect(built.result.ok).toBe(true);
  expect(built.artifacts.some((file) => file.path === 'assets/app.js')).toBe(true);
  expect(commands.some((args) => args[0] === 'rm' && args.includes('apps-unit'))).toBe(true);
  expect(commands.some((args) => args[0] === 'inspect' && args.includes('apps-unit'))).toBe(true);
});

it('emits an ES-module runner that walks artifacts without require', async () => {
  expect(trustedAppsContainerRunner).not.toMatch(/\brequire\s*\(/);
  expect(trustedAppsContainerRunner).toMatch(/readdirSync\(dir\)/);
  expect(trustedAppsContainerRunner).toMatch(/for \(const name of readdirSync\(toolchainRoot\)\)/);
  expect(trustedAppsContainerRunner).toMatch(/symlinkSync\(source, destination\)/);
  const work = await mkdtemp(join(tmpdir(), 'apps-walk-'));
  await writeFile(join(work, 'index.html'), '<!doctype html><html><body><div id="root"></div></body></html>');
  await mkdir(join(work, 'assets'));
  await writeFile(join(work, 'assets/app.js'), 'export const ready = true;\n');
  const hostWalk = collectArtifactTree(work);
  expect(hostWalk.map((file) => file.path).sort()).toEqual(['assets/app.js', 'index.html']);
  const collector = join(work, 'collect.mjs');
  await writeFile(collector, isolatedArtifactCollectorModule, 'utf8');
  const ran = spawnSync(process.execPath, [collector, work], { encoding: 'utf8' });
  expect(ran.status).toBe(0);
  expect(ran.stderr).toBe('');
  const collected = (JSON.parse(ran.stdout) as { path: string }[]).filter((file) => file.path !== 'collect.mjs');
  expect(collected.map((file) => file.path).sort()).toEqual(['assets/app.js', 'index.html']);
});

it('confirms named container teardown after cancel', async () => {
  const commands: string[][] = [];
  const closed = await removeNamedAppsContainer('apps-cancel', async (_file, args) => {
    commands.push([...args]);
    if (args[0] === 'rm') return { stdout: '' };
    throw new Error('Error: No such container: apps-cancel');
  });
  expect(closed.confirmed).toBe(true);
  expect(commands[0]?.[0]).toBe('rm');
  expect(commands[1]?.[0]).toBe('inspect');
});

it('builds the pinned image and runs the isolated Field Notes compile when isolation is required', async () => {
  const required = process.env.ARCHITECT_APPS_REQUIRE_ISOLATION === 'true';
  const probe = await probeAppsDockerIsolation({ PATH: process.env.PATH });
  if (!required) {
    if (!probe.available) expect(probe.code).toMatch(/not-installed|daemon-unavailable|timeout|error|empty-version/);
    return;
  }
  if (!probe.available) throw new Error(`Required isolated build unavailable: ${probe.reason}`);
  const inspect = spawnSync('docker', ['image', 'inspect', '--format', '{{.Id}} {{.RepoTags}}', defaultAppsImage], {
    encoding: 'utf8',
  });
  if (inspect.status !== 0) {
    const built = spawnSync('docker', ['build', '-t', defaultAppsImage, 'deploy/architect-apps'], {
      encoding: 'utf8',
    });
    if (built.status !== 0) {
      if (required)
        throw new Error(built.stderr || built.stdout || 'Pinned Architect Apps image could not be built.');
      return;
    }
  }
  const image = spawnSync('docker', ['image', 'inspect', '--format', '{{.Id}}', defaultAppsImage], {
    encoding: 'utf8',
  });
  expect(image.status).toBe(0);
  expect(image.stdout.trim()).toMatch(/^sha256:/);
  const isolated = await buildIsolatedGeneratedApp(notesSourceFiles(), {
    timeoutMs: 180000,
    name: 'apps-required-ci',
  });
  expect(
    isolated.result.ok,
    isolated.result.blocker ?? `${isolated.result.typecheck.log}\n${isolated.result.bundle.log}`,
  ).toBe(true);
  expect(isolated.result.isolation).toBe('docker');
  expect(isolated.result.sandbox).toBe(true);
  expect(isolated.artifacts.some((file) => file.path === 'assets/app.js')).toBe(true);
  const broken = notesSourceFiles().map((file) =>
    file.path === 'src/App.tsx' ? { ...file, content: 'export const broken: number = "no";\n' } : file,
  );
  const failed = await buildIsolatedGeneratedApp(broken, {
    timeoutMs: 120000,
    name: 'apps-required-fail',
  });
  expect(failed.result.ok).toBe(false);
  expect(failed.result.sandbox).toBe(false);
  expect(failed.artifacts).toEqual([]);
  const cancelled = await buildIsolatedGeneratedApp(notesSourceFiles(), {
    timeoutMs: 180000,
    name: 'apps-required-cancel',
    signal: AbortSignal.abort(),
  });
  expect(cancelled.result.ok).toBe(false);
  expect(cancelled.result.blocker).toMatch(/cancelled/i);
  expect(cancelled.artifacts).toEqual([]);
  const timed = await buildIsolatedGeneratedApp(notesSourceFiles(), {
    timeoutMs: 80,
    name: 'apps-required-timeout',
  });
  expect(timed.result.ok).toBe(false);
  expect(timed.artifacts).toEqual([]);
  const leftover = spawnSync('docker', ['inspect', 'apps-required-timeout'], { encoding: 'utf8' });
  expect(leftover.status !== 0 || /no such container/i.test(`${leftover.stderr}${leftover.stdout}`)).toBe(true);
}, 360000);

it('maps isolated work onto a shared host path and keeps generated containers off the Docker socket', () => {
  const root = '/tmp/architect-apps-work';
  expect(appsWorkRoot({ ARCHITECT_APPS_WORK_ROOT: root })).toBe(root);
  expect(assertHostVisibleWorkPath(`${root}/architect-apps-iso-abc`, { ARCHITECT_APPS_WORK_ROOT: root })).toBe(
    `${root}/architect-apps-iso-abc`,
  );
  expect(() => assertHostVisibleWorkPath('/tmp/other/iso', { ARCHITECT_APPS_WORK_ROOT: root })).toThrow(
    /shared host work root/i,
  );
  expect(() => appsWorkRoot({ ARCHITECT_APPS_WORK_ROOT: '/var/run/docker.sock/work' })).toThrow(/privileged/i);
  const generated = appsDockerInvocation(`${root}/src`, `${root}/runner.mjs`, defaultAppsImage, {
    jobFile: `${root}/job.json`,
    name: 'apps-shared',
  });
  expect(generated.args.join(' ')).not.toMatch(/docker\.sock/);
  const packaged = packagedWorkerInvocation({
    workRoot: root,
    dockerGid: 999,
    once: true,
    env: { APP_ENV: 'local', ARCHITECT_APPS_ENABLED: 'true' },
  });
  expect(() => assertPackagedWorkerIsolation(packaged.args)).not.toThrow();
  expect(packaged.args.join(' ')).toMatch(/docker\.sock/);
  expect(packaged.args).toContain(`${root}:${root}`);
  expect(packaged.args.join(' ')).not.toMatch(/OPENAI_API_KEY|privileged/);
  const topology = packagedWorkerTopologyArgs({
    workRoot: root,
    image: 'aethelios-architect-apps-worker:2026-10-15.1',
    toolchain: defaultAppsImage,
    probe: `${root}/topology-probe`,
    dockerGid: 118,
  });
  expect(topology[topology.indexOf('--group-add') + 1]).toBe('118');
  expect(topology[topology.indexOf('--user') + 1]).toBe('1000:1000');
  expect(topology).toContain('aethelios-architect-apps-worker:2026-10-15.1');
  expect(topology).toContain(defaultAppsImage);
  expect(topology).not.toContain('118:latest');
  expect(topology.includes('118') && topology[topology.indexOf('118') - 1] === '--group-add').toBe(true);
  const writeProof = packagedWorkerInvocation({
    workRoot: root,
    dockerGid: 118,
    proveWrite: true,
    env: { APP_ENV: 'local' },
  });
  expect(writeProof.args).toContain('--prove-write');
  expect(writeProof.args).toContain('aethelios-architect-apps-worker:2026-10-15.1');
  expect(writeProof.args[writeProof.args.indexOf('--group-add') + 1]).toBe('118');
  expect(writeProof.args).not.toContain('118:latest');
});

it('proves the packaged worker can see host-shared work through a sibling container', async () => {
  const required = process.env.ARCHITECT_APPS_REQUIRE_ISOLATION === 'true';
  const probe = await probeAppsDockerIsolation({ PATH: process.env.PATH });
  if (!required) {
    if (!probe.available) expect(probe.code).toMatch(/not-installed|daemon-unavailable|timeout|error|empty-version/);
    return;
  }
  if (!probe.available) throw new Error(`Required packaged-worker topology unavailable: ${probe.reason}`);
  const { executeWorkerImageBuild, defaultWorkerImage } = await import('../scripts/architect-apps-worker-image.mjs');
  const inspect = spawnSync('docker', ['image', 'inspect', '--format', '{{.Id}}', defaultWorkerImage], {
    encoding: 'utf8',
  });
  if (inspect.status !== 0) {
    const built = executeWorkerImageBuild({ inherit: false });
    if (built.action !== 'built') throw new Error(built.reason);
  }
  const toolchain = spawnSync('docker', ['image', 'inspect', '--format', '{{.Id}}', defaultAppsImage], {
    encoding: 'utf8',
  });
  if (toolchain.status !== 0)
    throw new Error('Required packaged-worker topology needs the pinned toolchain image on this runner.');
  const receipt = provePackagedWorkerTopology();
  expect(receipt.ok, receipt.output || receipt.reason).toBe(true);
}, 240000);

it('pins React type declarations in the isolated image', async () => {
  const dockerfile = await readFile('deploy/architect-apps/Dockerfile', 'utf8');
  expect(dockerfile).toMatch(/@types\/react@19\.3\.0/);
  expect(dockerfile).toMatch(/@types\/react-dom@19\.3\.0/);
  expect(defaultAppsImage).toBe('aethelios-architect-apps:2026-10-15.1');
});

it('Field Notes create retains the pending record identity across retries', () => {
  const app = notesSourceFiles().find((file) => file.path === 'src/App.tsx')?.content ?? '';
  expect(app).toMatch(/pending\?\.recordId/);
  expect(app).toMatch(/Retry keeps this same record/);
  expect(app).not.toMatch(/selected\?\.id \?\? crypto\.randomUUID\(\)/);
});
