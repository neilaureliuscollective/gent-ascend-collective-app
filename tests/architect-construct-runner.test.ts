import { describe, expect, it, vi } from 'vitest';
import { defaultProtectedPaths } from '@/domains/architect-construct/schema';
import { fixtureScope, fixtureSource } from '@/domains/architect-construct/fixture';
import { executeConstruct, executeInProcess } from '@/domains/architect-construct/runner';
import { assertSafeDockerArgs, dockerInvocation, resultFenceStart, resultFenceEnd } from '@/domains/architect-construct/docker';
import { labeledSource, treeHash } from '@/domains/architect-construct/hash';

const owner = '00000000-0000-4000-8000-000000000001';
const source = fixtureSource(owner, '00000000-0000-4000-8000-000000000011');
const scope = fixtureScope({
  projectId: '00000000-0000-4000-8000-000000000003',
  projectRevision: 1,
  sourceId: source.id,
  sourceTreeHash: source.tree_hash,
});

describe('Construct isolated runner', () => {
  it('applies the labelled fixture patch, runs checks, and collects preview', async () => {
    const result = await executeInProcess({ source, scope, previewPath: 'preview.html' });
    expect(result.isolation).toBe('process-fixture');
    expect(result.runtime_available).toBe(false);
    expect(result.sandbox).toBe(false);
    expect(result.changed_files).toEqual(['preview.html']);
    expect(result.diff).toContain('+<!doctype html>');
    expect(result.diff).toContain('<h1>After</h1>');
    expect(result.checks.map((check) => check.status)).toEqual(['passed', 'passed']);
    expect(result.preview.body).toContain('<h1>After</h1>');
    expect(result.preview.unavailable_reason).toBeNull();
  });

  it('records failing commands without forging success', async () => {
    const result = await executeInProcess({
      source,
      scope: {
        ...scope,
        acceptance_checks: [{ name: 'fail', command: 'false', args: [] }],
      },
    });
    expect(result.checks[0]).toMatchObject({ name: 'fail', status: 'failed' });
    expect(result.checks[0]!.exit_code).not.toBe(0);
    expect(result.sandbox).toBe(false);
  });

  it('blocks missing imported source before any Docker probe', async () => {
    const empty = {
      ...source,
      kind: 'imported' as const,
      files: [],
      tree_hash: treeHash([]),
      label: labeledSource('imported', source.repository, null),
    };
    const probe = vi.fn(async () => {
      throw new Error('probe must not run when source files are missing');
    });
    const result = await executeConstruct(
      { source: empty, scope: { ...scope, source_tree_hash: empty.tree_hash } },
      { probe },
    );
    expect(probe).not.toHaveBeenCalled();
    expect(result.isolation).toBe('unavailable');
    expect(result.runtime_available).toBe(false);
    expect(result.sandbox).toBe(false);
    expect(result.blocker).toMatch(/no files|Missing source/i);
    expect(result.checks.every((check) => check.status === 'blocked')).toBe(true);
  });

  it('does not treat a reachable Docker engine as a sandbox', async () => {
    const imported = { ...source, kind: 'imported' as const };
    const result = await executeConstruct(
      { source: imported, scope, previewPath: 'preview.html' },
      {
        probe: async () => ({
          available: true,
          backend: 'docker',
          version: '27.0.0',
          image: 'node:24-alpine',
          code: 'available',
          reason: null,
        }),
        ensureImage: async () => ({ ready: true, reason: null, pulled: false }),
        launchContainer: async () => ({
          exit_code: 1,
          stdout: '',
          stderr: 'image pull disabled in this unit test',
        }),
      },
    );
    expect(result.runtime_available).toBe(true);
    expect(result.sandbox).toBe(false);
    expect(result.isolation).toBe('unavailable');
    expect(result.blocker).toMatch(/not a sandbox|did not return a verified result/i);
  });

  it('records sandbox true only after a container launcher returns a verified result', async () => {
    const imported = { ...source, kind: 'imported' as const };
    const payload = {
      checks: [
        { name: 'syntax', command: 'node --check check.mjs', exit_code: 0, status: 'passed', log: '' },
        { name: 'heading', command: 'node check.mjs', exit_code: 0, status: 'passed', log: '' },
      ],
      changed_files: ['preview.html'],
      preview: { path: 'preview.html', body: '<h1>After</h1>', unavailable_reason: null },
    };
    const result = await executeConstruct(
      { source: imported, scope, previewPath: 'preview.html' },
      {
        requireIsolation: true,
        probe: async () => ({
          available: true,
          backend: 'docker',
          version: '27.0.0',
          image: 'node:24-alpine',
          code: 'available',
          reason: null,
        }),
        ensureImage: async () => ({ ready: true, reason: null, pulled: false }),
        launchContainer: async () => ({
          exit_code: 0,
          stdout: `${resultFenceStart}\n${JSON.stringify(payload)}\n${resultFenceEnd}\n`,
          stderr: '',
        }),
      },
    );
    expect(result.isolation).toBe('docker');
    expect(result.runtime_available).toBe(true);
    expect(result.sandbox).toBe(true);
    expect(result.diff).toContain('<h1>After</h1>');
    expect(result.preview.body).toContain('<h1>After</h1>');
  });

  it('builds a disposable container invocation without host secrets or docker.sock', () => {
    const invocation = dockerInvocation('/tmp/construct-src', '/tmp/construct-runner.mjs', 'node:24-alpine', {
      jobFile: '/tmp/construct-job.json',
      outDir: '/tmp/construct-out',
    });
    assertSafeDockerArgs(invocation.args);
    expect(invocation.args).toContain('--network');
    expect(invocation.args).toContain('none');
    expect(invocation.args.join(' ')).not.toContain('docker.sock');
    expect(invocation.args.join(' ')).not.toContain('OPENAI');
  });

  it('rejects protected or out-of-scope patches before writing', async () => {
    await expect(
      executeInProcess({
        source,
        scope: {
          ...scope,
          allowed_paths: ['.env'],
          protected_paths: defaultProtectedPaths(),
          patch: [{ path: '.env', before: '', after: 'SECRET=1' }],
        },
      }),
    ).rejects.toThrow(/protected|allowlist|safe relative/i);
  });
});
