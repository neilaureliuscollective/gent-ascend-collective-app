import { expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  appsDockerInvocation,
  assertSafeAppsDockerArgs,
  buildIsolatedGeneratedApp,
  collectArtifactTree,
  isolatedArtifactCollectorModule,
  parseAppsContainerResult,
  parseAppsToolchainVersions,
  removeNamedAppsContainer,
  trustedAppsContainerRunner,
  appsNobody,
} from '@/domains/architect-apps/isolate';
import { acceptAppBuildSuccess, resolveAppExecutionKind } from '@/domains/architect-apps/worker';
import { notesSourceFiles } from '@/domains/architect-apps/notes-fixture';

it('builds a non-root isolated Docker invocation without host credentials or socket', () => {
  const invocation = appsDockerInvocation('/tmp/apps-src', '/tmp/apps-runner.mjs', 'aethelios-architect-apps:2026-10-14.1', {
    jobFile: '/tmp/apps-job.json',
    name: 'apps-unit',
  });
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
    env: { PATH: '/usr/bin', ARCHITECT_APPS_IMAGE: 'aethelios-architect-apps:2026-10-14.1' },
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
