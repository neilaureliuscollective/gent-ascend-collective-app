import { describe, expect, it } from 'vitest';
import { combineRepairPatch } from '@/domains/architect-construct/combine-patch';
import { repairEligible } from '@/domains/architect-construct/repair-eligibility';
import { executeInProcess } from '@/domains/architect-construct/runner';
import { fixtureScope, fixtureSource } from '@/domains/architect-construct/fixture';
import { treeHash } from '@/domains/architect-construct/hash';
import { defaultProtectedPaths, type ConstructBrief, type ConstructRun } from '@/domains/architect-construct/schema';

const parentId = '00000000-0000-4000-8000-000000000081';
const hash = 'a'.repeat(64);
const tree = 'b'.repeat(64);

function parentRun(overrides: Partial<ConstructRun> = {}): ConstructRun {
  return {
    id: parentId,
    person_id: '00000000-0000-4000-8000-000000000001',
    project_id: '00000000-0000-4000-8000-000000000003',
    brief_id: '00000000-0000-4000-8000-000000000082',
    approval_hash: hash,
    source_id: '00000000-0000-4000-8000-000000000083',
    source_kind: 'imported',
    source_tree_hash: tree,
    project_revision: 1,
    status: 'failed',
    cancel_requested: false,
    worker_id: null,
    lease_token: null,
    lease_until: null,
    parent_run_id: null,
    result: {
      isolation: 'process-fixture',
      runtime_available: false,
      sandbox: false,
      blocker: null,
      source_hash: tree,
      result_hash: null,
      changed_files: ['ok.mjs'],
      diff: '',
      checks: [],
      coverage: {
        no_applicable: false,
        preexisting_failures: ['syntax:node --check broken.mjs:broken.mjs'],
        introduced_failures: ['syntax:node --check ok.mjs:ok.mjs'],
        untested: [],
        unsupported: [{ kind: 'typecheck', reason: 'Unsupported in this sandbox.' }],
        revision_note: '1',
      },
      preview: { path: null, body: '', unavailable_reason: 'none' },
      artifacts: [],
    },
    created_at: '2026-10-14T00:00:00.000Z',
    updated_at: '2026-10-14T00:00:00.000Z',
    ...overrides,
  };
}

describe('check-driven repair eligibility', () => {
  it('allows one repair for a failed run with identified introduced failures', () => {
    const eligible = repairEligible({
      parent: parentRun(),
      brief: null,
      runs: [],
      briefs: [],
    });
    expect(eligible.ok).toBe(true);
    if (eligible.ok) expect(eligible.targets.join(' ')).toMatch(/ok\.mjs/);
  });

  it('refuses a parent that is already a repair and a stale project revision', () => {
    expect(
      repairEligible({
        parent: parentRun({ parent_run_id: '00000000-0000-4000-8000-000000000080' }),
        brief: null,
        runs: [],
        briefs: [],
      }).ok,
    ).toBe(false);
    expect(
      repairEligible({
        parent: parentRun({ parent_run_id: '00000000-0000-4000-8000-000000000080' }),
        brief: null,
        runs: [],
        briefs: [],
      }),
    ).toMatchObject({ code: 'parent-is-repair' });
    expect(
      repairEligible({
        parent: parentRun(),
        brief: null,
        projectRevision: 2,
        runs: [],
        briefs: [],
      }),
    ).toMatchObject({ ok: false, code: 'stale-revision' });
  });

  it('refuses pre-existing-only, ambiguous and second repairs', () => {
    expect(
      repairEligible({
        parent: parentRun({
          result: {
            ...parentRun().result!,
            coverage: {
              ...parentRun().result!.coverage!,
              introduced_failures: [],
            },
          },
        }),
        brief: null,
        runs: [],
        briefs: [],
      }).ok,
    ).toBe(false);
    expect(
      repairEligible({
        parent: parentRun({
          result: {
            ...parentRun().result!,
            coverage: {
              ...parentRun().result!.coverage!,
              comparison_note: 'Check comparison is unavailable because stored results share a duplicate identity.',
            },
          },
        }),
        brief: null,
        runs: [],
        briefs: [],
      }).ok,
    ).toBe(false);
    expect(
      repairEligible({
        parent: parentRun(),
        brief: null,
        runs: [{ id: '00000000-0000-4000-8000-000000000084', parent_run_id: parentId }],
        briefs: [],
      }).ok,
    ).toBe(false);
  });
});

describe('combined repair patch', () => {
  it('applies the repair against the original pinned source, not the failed after-text', () => {
    const source = [{ path: 'ok.mjs', content: 'export const heading = "Before";\n' }];
    const original = [
      {
        path: 'ok.mjs',
        before: source[0]!.content,
        after: 'export const heading = "After"\nconst introduced = ;\n',
      },
    ];
    const repair = [
      {
        path: 'ok.mjs',
        before: original[0]!.after,
        after: 'export const heading = "After";\n',
      },
    ];
    const combined = combineRepairPatch({
      sourceFiles: source,
      originalPatch: original,
      repairPatch: repair,
      allowedPaths: ['ok.mjs'],
      protectedPaths: defaultProtectedPaths(),
    });
    expect(combined.ok).toBe(true);
    if (combined.ok) {
      expect(combined.patch[0]).toEqual({
        path: 'ok.mjs',
        before: 'export const heading = "Before";\n',
        after: 'export const heading = "After";\n',
      });
    }
  });

  it('executes the combined repair against the original source and clears the introduced syntax failure', async () => {
    const files = [{ path: 'ok.mjs', content: 'export const heading = "Before";\n' }];
    const original = [
      {
        path: 'ok.mjs',
        before: files[0]!.content,
        after: 'export const heading = "After"\nconst introduced = ;\n',
      },
    ];
    const combined = combineRepairPatch({
      sourceFiles: files,
      originalPatch: original,
      repairPatch: [
        {
          path: 'ok.mjs',
          before: original[0]!.after,
          after: 'export const heading = "After";\n',
        },
      ],
      allowedPaths: ['ok.mjs'],
      protectedPaths: defaultProtectedPaths(),
    });
    expect(combined.ok).toBe(true);
    if (!combined.ok) return;
    const source = {
      ...fixtureSource('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000085'),
      files,
      tree_hash: treeHash(files),
    };
    const result = await executeInProcess({
      source,
      scope: {
        ...fixtureScope({
          projectId: '00000000-0000-4000-8000-000000000003',
          projectRevision: 1,
          sourceId: source.id,
          sourceTreeHash: source.tree_hash,
        }),
        allowed_paths: ['ok.mjs'],
        acceptance_checks: [{ name: 'syntax:ok.mjs', command: 'node', args: ['--check', 'ok.mjs'] }],
        patch: combined.patch,
      },
    });
    expect(result.checks[0]?.status).toBe('passed');
    expect(result.coverage?.introduced_failures).toEqual([]);
  });
});

describe('repair brief digest stays distinct', () => {
  it('keeps parent approval hash out of the repair scope identity', () => {
    const repair: ConstructBrief['scope']['repair'] = {
      kind: 'check-driven',
      parent_run_id: parentId,
      parent_approval_hash: hash,
      targets: ['syntax:ok.mjs'],
    };
    expect(repair?.parent_approval_hash).toBe(hash);
    expect(repair?.parent_run_id).toBe(parentId);
  });
});
