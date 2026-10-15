import { expect, it } from 'vitest';
import { mkdtempSync as fsMkdtemp, rmSync } from 'node:fs';
import os, { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createWorkerImageStage,
  executeWorkerImageBuild,
  workerImageBuildArgs,
} from '../scripts/architect-apps-worker-image.mjs';

it('creates the worker image stage with the Node filesystem API and executes the image-build command', () => {
  expect('mkdtempSync' in os).toBe(false);
  expect(fsMkdtemp).toBeTypeOf('function');
  const stage = createWorkerImageStage();
  expect(stage.startsWith(join(tmpdir(), 'apps-worker-image-'))).toBe(true);
  rmSync(stage, { recursive: true, force: true });
  const commands: string[][] = [];
  const receipt = executeWorkerImageBuild({
    silent: true,
    inherit: false,
    spawn: (file, args) => {
      commands.push([file, ...args]);
      if (file === 'docker' && args[0] === 'version') return { status: 0, stdout: '28.0.1\n' };
      if (typeof file === 'string' && file.includes('node') && args.some((value) => String(value).includes('--bundle-out=')))
        return { status: 0, stdout: '{"action":"bundled"}\n' };
      if (file === 'docker' && args[0] === 'build') return { status: 0, stdout: '' };
      if (file === 'docker' && args[0] === 'image') return { status: 0, stdout: `sha256:${'ab'.repeat(32)}\n` };
      return { status: 0, stdout: '' };
    },
  });
  expect(receipt.action).toBe('built');
  expect(commands.some((row) => row[0] === 'docker' && row[1] === 'build')).toBe(true);
  expect(workerImageBuildArgs('aethelios-architect-apps-worker:2026-10-15.1', '/tmp/stage')).toEqual([
    'build',
    '-t',
    'aethelios-architect-apps-worker:2026-10-15.1',
    '/tmp/stage',
  ]);
});

it('builds the packaged worker image when Docker is available', () => {
  const required = process.env.ARCHITECT_APPS_REQUIRE_ISOLATION === 'true';
  const receipt = executeWorkerImageBuild({ inherit: false });
  if (receipt.action === 'unavailable') {
    if (required) throw new Error(receipt.reason);
    expect(receipt.reason).toMatch(/Docker is not available/i);
    return;
  }
  expect(receipt.action, receipt.reason).toBe('built');
  expect(receipt.id).toMatch(/^sha256:/);
}, 180000);
