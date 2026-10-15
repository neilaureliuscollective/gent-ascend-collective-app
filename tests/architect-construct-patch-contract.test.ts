import { describe, expect, it } from 'vitest';
import { validateExistingFilePatches, creationOrDeletionMessage } from '@/domains/architect-construct/patch-contract';
import { applyTrustedPatch, executeInProcess } from '@/domains/architect-construct/runner';
import { defaultLimits, defaultProtectedPaths } from '@/domains/architect-construct/schema';
import { fixtureScope, fixtureSource } from '@/domains/architect-construct/fixture';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { treeHash } from '@/domains/architect-construct/hash';

const files = [
  { path: 'keep.js', content: 'export const keep = 1;\n' },
  { path: 'edit.js', content: 'export const heading = "Before";\n' },
  { path: 'other.js', content: 'export const other = 2;\n' },
];

function validate(patch: { path: string; before: string; after: string }[]) {
  return validateExistingFilePatches({
    files,
    patch,
    allowedPaths: files.map((file) => file.path),
    protectedPaths: defaultProtectedPaths(),
    editablePaths: files.map((file) => file.path),
  });
}

describe('existing-file patch contract', () => {
  it('preserves unrelated content in a multi-file change', async () => {
    const source = {
      ...fixtureSource('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000061'),
      files,
      tree_hash: treeHash(files),
    };
    const scope = {
      ...fixtureScope({
        projectId: '00000000-0000-4000-8000-000000000003',
        projectRevision: 1,
        sourceId: source.id,
        sourceTreeHash: source.tree_hash,
      }),
      allowed_paths: files.map((file) => file.path),
      acceptance_checks: [],
      patch: [
        { path: 'edit.js', before: files[1]!.content, after: 'export const heading = "After";\n' },
        { path: 'other.js', before: files[2]!.content, after: 'export const other = 3;\n' },
      ],
    };
    const result = await executeInProcess({ source, scope });
    expect(result.changed_files.sort()).toEqual(['edit.js', 'other.js']);
    expect(result.diff).not.toContain('export const keep');
    const root = await mkdtemp(join(tmpdir(), 'architect-unrelated-'));
    try {
      await mkdir(root, { recursive: true });
      for (const file of files) await writeFile(join(root, file.path), file.content);
      await applyTrustedPatch(root, scope);
      expect(await readFile(join(root, 'keep.js'), 'utf8')).toBe(files[0]!.content);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects stale source, truncated stand-ins, foreign paths and duplicate edits', () => {
    expect(
      validate([{ path: 'edit.js', before: 'stale', after: 'export const heading = "After";\n' }]).ok,
    ).toBe(false);
    expect(
      validate([
        {
          path: 'edit.js',
          before: files[1]!.content.slice(0, 8),
          after: 'export const heading = "After";\n',
        },
      ]),
    ).toMatchObject({ ok: false, code: 'truncated-before' });
    expect(
      validate([{ path: '../secret.js', before: '', after: 'no' }]),
    ).toMatchObject({ ok: false, code: 'foreign-path' });
    expect(
      validate([
        { path: 'edit.js', before: files[1]!.content, after: 'a' },
        { path: 'edit.js', before: files[1]!.content, after: 'b' },
      ]),
    ).toMatchObject({ ok: false, code: 'duplicate-path' });
  });

  it('keeps creation and deletion unsupported and distinguishes emptying from deleting', async () => {
    expect(creationOrDeletionMessage('create')).toMatch(/not supported/i);
    expect(creationOrDeletionMessage('delete')).toMatch(/empties a file/i);
    expect(
      validateExistingFilePatches({
        files,
        patch: [{ path: 'new.js', before: '', after: 'export const created = true;\n' }],
        allowedPaths: [...files.map((file) => file.path), 'new.js'],
        protectedPaths: defaultProtectedPaths(),
        editablePaths: files.map((file) => file.path),
      }),
    ).toMatchObject({
      ok: false,
      code: 'create-unsupported',
    });
    const emptied = validate([{ path: 'edit.js', before: files[1]!.content, after: '' }]);
    expect(emptied.ok).toBe(true);
    if (emptied.ok) expect(emptied.warnings[0]).toMatch(/not deletion/i);
    const root = await mkdtemp(join(tmpdir(), 'architect-empty-'));
    try {
      await writeFile(join(root, 'edit.js'), files[1]!.content);
      const scope = {
        allowed_paths: ['edit.js'],
        protected_paths: defaultProtectedPaths(),
        resource_limits: defaultLimits,
        patch: [{ path: 'edit.js', before: files[1]!.content, after: '' }],
      };
      await applyTrustedPatch(root, scope as never);
      expect(await readFile(join(root, 'edit.js'), 'utf8')).toBe('');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('treats an empty proposal as a refusal, not success', () => {
    expect(validate([])).toMatchObject({ ok: false, code: 'empty-proposal' });
  });
});
