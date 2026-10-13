import { describe, expect, it } from 'vitest';
import { defaultProtectedPaths } from '@/domains/architect-construct/schema';
import { fixtureScope, fixtureSource } from '@/domains/architect-construct/fixture';
import { executeConstruct, executeInProcess } from '@/domains/architect-construct/runner';
import { assertSafeDockerArgs, dockerInvocation, probeDockerIsolation } from '@/domains/architect-construct/docker';
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
  });

  it('blocks missing imported source instead of inventing files', async () => {
    const empty = {
      ...source,
      kind: 'imported' as const,
      files: [],
      tree_hash: treeHash([]),
      label: labeledSource('imported', source.repository, null),
    };
    const result = await executeConstruct({
      source: empty,
      scope: { ...scope, source_tree_hash: empty.tree_hash },
    });
    expect(result.isolation).toBe('unavailable');
    expect(result.sandbox).toBe(false);
    expect(result.blocker).toMatch(/Docker is not installed|Missing source|no files|unavailable/i);
    expect(result.checks.every((check) => check.status === 'blocked' || check.status === 'not-run')).toBe(
      true,
    );
  });

  it('builds a disposable container invocation without host secrets or docker.sock', () => {
    const invocation = dockerInvocation('/tmp/construct-src', '/tmp/construct-runner.mjs');
    assertSafeDockerArgs(invocation.args);
    expect(invocation.args).toContain('--network');
    expect(invocation.args).toContain('none');
    expect(invocation.args.join(' ')).not.toContain('docker.sock');
    expect(invocation.args.join(' ')).not.toContain('OPENAI');
  });

  it('reports the exact Docker runtime blocker in this environment', async () => {
    const probe = await probeDockerIsolation({ ...process.env, PATH: '/usr/bin:/bin' });
    expect(probe.available).toBe(false);
    if (!probe.available) expect(probe.reason).toMatch(/Docker is not installed/);
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
