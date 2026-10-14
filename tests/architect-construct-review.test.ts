import { describe, expect, it } from 'vitest';
import { lineDiff, unifiedHunk } from '@/domains/architect-construct/review-diff';
import { prepareSourceContext } from '@/domains/architect-construct/source-context';
import { persistableCheckPlan, planCheckCoverage } from '@/domains/architect-construct/check-coverage';

describe('review presentation helpers', () => {
  it('builds a truthful before/after line diff', () => {
    const lines = lineDiff('<h1>Before</h1>\n<p>Keep</p>\n', '<h1>After</h1>\n<p>Keep</p>\n');
    expect(lines.filter((line) => line.kind === 'remove').map((line) => line.text)).toEqual(['<h1>Before</h1>']);
    expect(lines.filter((line) => line.kind === 'add').map((line) => line.text)).toEqual(['<h1>After</h1>']);
    expect(unifiedHunk('preview.html', 'Before', 'After')).toContain('-Before');
    expect(unifiedHunk('preview.html', 'Before', 'After')).toContain('+After');
  });

  it('keeps local source selection and coverage aligned with the same real files', () => {
    const files = [
      { path: 'preview.html', content: '<h1>Before</h1>' },
      { path: 'check.mjs', content: 'export const ok = true;\n' },
    ];
    const context = prepareSourceContext({
      files,
      allowedPaths: files.map((file) => file.path),
      protectedPaths: ['.env'],
      intendedChange: 'Replace the heading.',
    });
    const coverage = persistableCheckPlan(planCheckCoverage(files));
    expect(context.entries.map((entry) => entry.path)).toEqual(expect.arrayContaining(['preview.html', 'check.mjs']));
    expect(coverage.applicable[0]?.target).toBe('check.mjs');
    expect(coverage.no_applicable).toBe(false);
  });
});
