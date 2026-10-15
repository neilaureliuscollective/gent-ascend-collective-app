import { expect, it } from 'vitest';
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  classifyAppsWorkRoot,
  appsWorkUser,
  inspectAppsWorkRoot,
  proveWorkerOwnedWorkspace,
} from '@/domains/architect-apps/work-root';
import { preparePackagedWorkRoot, packagedWorkerInvocation } from '../scripts/architect-apps-packaged-worker.mjs';

it('accepts a uid-1000 0755 work root and refuses world-writable or host-owned directories', () => {
  expect(
    classifyAppsWorkRoot({ uid: 1000, gid: 1000, mode: 0o40755 }, appsWorkUser),
  ).toMatchObject({ ok: true, code: 'ready', mode: '755' });
  expect(classifyAppsWorkRoot({ uid: 0, gid: 0, mode: 0o40755 }, appsWorkUser)).toMatchObject({
    ok: false,
    code: 'owner-mismatch',
  });
  expect(classifyAppsWorkRoot({ uid: 1000, gid: 1000, mode: 0o40777 }, appsWorkUser)).toMatchObject({
    ok: false,
    code: 'world-writable',
  });
  expect(classifyAppsWorkRoot({ uid: 1000, gid: 118, mode: 0o42775 }, appsWorkUser)).toMatchObject({
    ok: true,
    code: 'ready',
    mode: '775',
  });
  expect(classifyAppsWorkRoot({ uid: 1000, gid: 1000, mode: 0o40555 }, appsWorkUser)).toMatchObject({
    ok: false,
    code: 'not-writable',
  });
  expect(inspectAppsWorkRoot(join(tmpdir(), `apps-missing-${process.pid}`))).toMatchObject({
    ok: false,
    code: 'missing',
  });
});

it('proves a worker-owned workspace file and refuses chmod 777 as a preparation success', () => {
  const root = join(tmpdir(), `apps-work-root-${process.pid}`);
  mkdirSync(root, { recursive: true });
  try {
    const current = process.getuid?.();
    if (current === 1000) {
      const proved = proveWorkerOwnedWorkspace(root);
      expect(proved.ok).toBe(true);
      expect(() => statSync(proved.marker)).toThrow();
    } else {
      expect(inspectAppsWorkRoot(root).ok).toBe(current === 1000);
    }
    const prepared = preparePackagedWorkRoot(root, (file, args) => {
      if (file === 'stat') return { status: 0, stdout: '1000 1000 777\n' };
      if (file === 'sudo') return { status: 1, stdout: '', stderr: 'refused' };
      return { status: 1, stdout: '', stderr: `${file} ${args.join(' ')}` };
    });
    expect(prepared.ok).toBe(false);
    expect(prepared.reason).toMatch(/uid 1000 mode 0755|2775/i);
    expect(prepared.reason).toMatch(/do not chmod 777/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it('keeps packaged write and compile proofs on the worker image, not a numeric group id', () => {
  const compile = packagedWorkerInvocation({
    workRoot: '/tmp/architect-apps-work',
    dockerGid: 118,
    compileFixture: true,
    env: { APP_ENV: 'local' },
  });
  expect(compile.args).toContain('--compile-fixture');
  expect(compile.args).toContain('aethelios-architect-apps-worker:2026-10-15.1');
  expect(compile.args).not.toContain('118:latest');
  expect(compile.args.join(' ')).not.toMatch(/privileged|OPENAI_API_KEY|chmod 777/);
});
