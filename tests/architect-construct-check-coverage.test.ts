import { describe, expect, it } from 'vitest';
import {
  acceptanceChecksFromPlan,
  classifyCheckDelta,
  noApplicableChecksLabel,
  planCheckCoverage,
} from '@/domains/architect-construct/check-coverage';
import { executeInProcess } from '@/domains/architect-construct/runner';
import { fixtureScope, fixtureSource } from '@/domains/architect-construct/fixture';
import { defaultProtectedPaths } from '@/domains/architect-construct/schema';
import { treeHash } from '@/domains/architect-construct/hash';

describe('construct check coverage', () => {
  it('reports no applicable checks instead of a no-op present pass', () => {
    const plan = planCheckCoverage([
      { path: 'preview.html', content: '<h1>Before</h1>' },
      { path: 'notes.md', content: '# Notes\n' },
    ]);
    expect(plan.no_applicable).toBe(true);
    expect(acceptanceChecksFromPlan(plan)).toEqual([]);
    expect(noApplicableChecksLabel(plan)).toBe('No applicable checks available');
    expect(plan.unsupported.some((item) => item.kind === 'functional')).toBe(true);
  });

  it('plans syntax-only coverage for JavaScript without claiming type or build proof', () => {
    const plan = planCheckCoverage([
      { path: 'check.mjs', content: 'export const ok = true;\n' },
      { path: 'package.json', content: '{"scripts":{"build":"next build","test":"vitest"}}' },
      { path: 'tsconfig.json', content: '{}' },
    ]);
    expect(plan.no_applicable).toBe(false);
    expect(plan.applicable[0]).toMatchObject({ kind: 'syntax', target: 'check.mjs' });
    expect(acceptanceChecksFromPlan(plan)[0]).toEqual({
      name: 'syntax:check.mjs',
      command: 'node',
      args: ['--check', 'check.mjs'],
    });
    expect(noApplicableChecksLabel(plan)).toBe('Syntax-only coverage');
    expect(plan.unsupported.map((item) => item.kind)).toEqual(
      expect.arrayContaining(['typecheck', 'build', 'functional']),
    );
  });

  it('separates introduced failures from pre-existing failures', async () => {
    const files = [
      { path: 'broken.mjs', content: 'const broken = ;\n' },
      { path: 'ok.mjs', content: 'export const heading = "Before";\n' },
    ];
    const source = {
      ...fixtureSource('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000071'),
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
      allowed_paths: ['broken.mjs', 'ok.mjs'],
      protected_paths: defaultProtectedPaths(),
      acceptance_checks: [
        { name: 'syntax:broken.mjs', command: 'node' as const, args: ['--check', 'broken.mjs'] },
        { name: 'syntax:ok.mjs', command: 'node' as const, args: ['--check', 'ok.mjs'] },
      ],
      patch: [
        {
          path: 'ok.mjs',
          before: files[1]!.content,
          after: 'export const heading = "After"\nconst introduced = ;\n',
        },
      ],
    };
    const result = await executeInProcess({ source, scope });
    expect(result.baseline_checks?.map((check) => check.status)).toEqual(['failed', 'passed']);
    expect(result.checks.map((check) => check.status)).toEqual(['failed', 'failed']);
    expect(result.coverage?.preexisting_failures).toEqual(['syntax:broken.mjs']);
    expect(result.coverage?.introduced_failures).toEqual(['syntax:ok.mjs']);
    expect(classifyCheckDelta(result.baseline_checks ?? [], result.checks)).toEqual({
      preexisting_failures: ['syntax:broken.mjs'],
      introduced_failures: ['syntax:ok.mjs'],
    });
  });
});
