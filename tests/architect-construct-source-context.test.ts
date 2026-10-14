import { describe, expect, it } from 'vitest';
import { sha256Text } from '@/domains/architect-construct/hash';
import {
  SOURCE_CONTEXT_BUDGET,
  prepareSourceContext,
} from '@/domains/architect-construct/source-context';

function files(items: Array<[string, string]>) {
  return items.map(([path, content]) => ({ path, content }));
}

describe('Architect source context', () => {
  it('includes a file larger than 4KB as a complete editable original', () => {
    const large = `const heading = 'Before';\n${'x'.repeat(5000)}`;
    const context = prepareSourceContext({
      files: files([['app.js', large]]),
      allowedPaths: ['app.js'],
      protectedPaths: ['.env'],
      intendedChange: 'Replace Before with After.',
      hash: sha256Text,
    });
    expect(large.length).toBeGreaterThan(SOURCE_CONTEXT_BUDGET.formerExcerptChars);
    expect(context.editable).toEqual([{ path: 'app.js', content: large }]);
    expect(context.entries[0]).toMatchObject({
      path: 'app.js',
      inclusion: 'complete',
      complete: true,
      content_hash: sha256Text(large),
    });
    expect(context.refusal).toBeNull();
    expect(context.complete_repository).toBe(false);
  });

  it('refuses a file that cannot fit the whole-file budget instead of sending an excerpt as the original', () => {
    const huge = `const heading = 'Before';\n${'y'.repeat(SOURCE_CONTEXT_BUDGET.maxEditableTotalBytes + 80)}`;
    const context = prepareSourceContext({
      files: files([['app.js', huge]]),
      allowedPaths: ['app.js'],
      protectedPaths: ['.env'],
      intendedChange: 'Replace Before with After.',
      hash: sha256Text,
    });
    expect(context.editable).toEqual([]);
    expect(context.entries[0]?.inclusion).toBe('too-large');
    expect(context.entries[0]?.complete).toBe(false);
    expect(context.entries[0]?.excerpt).toContain('not the complete file');
    expect(context.refusal).toMatch(/excerpt as the original|smaller scope|whole-file budget/i);
  });

  it('surfaces relevant context beyond the former eight-file cutoff', () => {
    const many = Array.from({ length: 10 }, (_, index) => [
      `file-${index}.js`,
      `export const n${index} = ${index};\n`,
    ] as [string, string]);
    const context = prepareSourceContext({
      files: files(many),
      allowedPaths: many.map(([path]) => path),
      protectedPaths: ['.env'],
      intendedChange: 'Edit the counters.',
    });
    expect(context.editable).toHaveLength(SOURCE_CONTEXT_BUDGET.maxEditableFiles);
    expect(context.editable.length).toBe(SOURCE_CONTEXT_BUDGET.formerFileCutoff);
    const omitted = context.entries.filter((entry) => entry.inclusion === 'omitted');
    expect(omitted.length).toBeGreaterThan(0);
    expect(omitted[0]?.reason).toMatch(/beyond the 8-file|cutoff/i);
    expect(context.complete_repository).toBe(false);
  });

  it('records missing imports without inventing repository files', () => {
    const context = prepareSourceContext({
      files: files([['app.js', "import { helper } from './helper.js';\nexport const ok = true;\n"]]),
      allowedPaths: ['app.js'],
      protectedPaths: ['.env'],
      intendedChange: 'Use the helper.',
    });
    expect(context.missing).toContain('helper.js');
    expect(context.entries.some((entry) => entry.role === 'missing-import' && entry.path === 'helper.js')).toBe(
      true,
    );
  });

  it('keeps package instructions as excerpts, not editable originals, when other source is present', () => {
    const context = prepareSourceContext({
      files: files([
        ['app.js', 'export const ready = true;\n'],
        ['package.json', '{"name":"demo","scripts":{"build":"next build"}}'],
      ]),
      allowedPaths: ['app.js', 'package.json'],
      protectedPaths: ['.env'],
      intendedChange: 'Keep the export.',
    });
    expect(context.editable.map((file) => file.path)).toEqual(['app.js']);
    expect(context.entries.find((entry) => entry.path === 'package.json')?.inclusion).toBe('excerpt');
  });
});
