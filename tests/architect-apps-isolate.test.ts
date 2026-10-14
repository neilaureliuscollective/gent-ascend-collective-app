import { expect, it } from 'vitest';
import {
  appsDockerInvocation,
  assertSafeAppsDockerArgs,
  buildIsolatedGeneratedApp,
  parseAppsContainerResult,
  parseAppsToolchainVersions,
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
      artifacts: [{ path: 'index.html', content: '<html><body>Field notes</body></html>' }],
    }),
    'APPS_RESULT_END',
  ].join('\n');
  expect(parseAppsToolchainVersions(JSON.stringify({ typescript: '6.0.3', vite: '8.3.0', react: '19.3.0' })).ok).toBe(true);
  expect(parseAppsToolchainVersions(JSON.stringify({ typescript: '5.0.0', vite: '8.3.0', react: '19.3.0' })).ok).toBe(false);
  expect(parseAppsContainerResult(fenced)?.sandbox).toBe(true);
  const built = await buildIsolatedGeneratedApp(notesSourceFiles(), {
    exec: async (_file, args) => {
      if (args[0] === 'version') return { stdout: '28.0.1\n' };
      assertSafeAppsDockerArgs([...args]);
      expect(args).toContain('--network');
      return { stdout: fenced, stderr: 'APPS_WORKSPACE {"identity":{"uid":65534,"gid":65534}}' };
    },
    env: { PATH: '/usr/bin', ARCHITECT_APPS_IMAGE: 'aethelios-architect-apps:2026-10-14.1' },
  });
  expect(built.result.isolation).toBe('docker');
  expect(built.result.sandbox).toBe(true);
  expect(built.result.ok).toBe(true);
  expect(built.artifacts[0]?.content).toMatch(/Field notes/);
});
