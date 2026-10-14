import { describe, expect, it } from 'vitest';
import { sha256Text } from '@/domains/architect-construct/hash';
import {
  SOURCE_CONTEXT_BUDGET,
  prepareSourceContext,
  providerPromptText,
  providerRequestContentStats,
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

  it('keeps too-large manifest excerpts inside the eight-excerpt content budget', () => {
    const large = `export const heading = 'Before';\n${'x'.repeat(48000)}`;
    const extras = Array.from({ length: 9 }, (_, index) => [
      `extra-${index}.js`,
      `${'y'.repeat(2001)}\n`,
    ] as [string, string]);
    const context = prepareSourceContext({
      files: files([['app.js', large], ...extras]),
      allowedPaths: ['app.js', ...extras.map(([path]) => path)],
      protectedPaths: ['.env'],
      intendedChange: 'Edit app.js heading.',
    });
    expect(context.editable.map((file) => file.path)).toEqual(['app.js']);
    expect(context.refusal).toBeNull();
    const contentBearing = context.entries.filter((entry) => Boolean(entry.excerpt));
    expect(contentBearing.length).toBeLessThanOrEqual(SOURCE_CONTEXT_BUDGET.maxExcerptFiles);
    const stats = providerRequestContentStats(context);
    expect(stats.excerptFileCount).toBeLessThanOrEqual(SOURCE_CONTEXT_BUDGET.maxExcerptFiles);
    expect(stats.smuggledManifestExcerpts).toBe(0);
    expect(stats.excerptBytes).toBeLessThanOrEqual(SOURCE_CONTEXT_BUDGET.maxExcerptTotalBytes);
    const prompt = providerPromptText(context);
    expect(prompt).toContain('export const heading');
    const omittedExtras = context.entries.filter(
      (entry) => entry.path.startsWith('extra-') && !entry.excerpt,
    );
    expect(omittedExtras.length).toBeGreaterThan(0);
    expect(omittedExtras[0]?.reason).toMatch(/excerpt omitted|context budget|cutoff|complete file/i);
  });

  it('accounts referenced excerpts with the same serialized content budget', () => {
    const related = Array.from({ length: 10 }, (_, index) => [
      `lib-${index}.js`,
      `export const n${index} = ${index};\n${'z'.repeat(1800)}`,
    ] as [string, string]);
    const importer = `import { n0 } from './lib-0.js';\n${related
      .slice(1)
      .map(([path], index) => `import { n${index + 1} } from './${path}';`)
      .join('\n')}\nexport const heading = 'Before';\n`;
    const context = prepareSourceContext({
      files: files([['app.js', importer], ...related]),
      allowedPaths: ['app.js', ...related.map(([path]) => path)],
      protectedPaths: ['.env'],
      intendedChange: 'Keep the importer.',
    });
    const stats = providerRequestContentStats(context);
    expect(stats.excerptFileCount).toBeLessThanOrEqual(SOURCE_CONTEXT_BUDGET.maxExcerptFiles);
    expect(stats.smuggledManifestExcerpts).toBe(0);
    expect(context.editable.some((file) => file.path === 'app.js')).toBe(true);
  });

  it('keeps mixed editable, referenced, instruction and too-large files inside the serialized contract', () => {
    const editable = `export const heading = 'Before';\n`;
    const instruction = `${'{"name":"app","scripts":{"build":"next build"}}'}${' '.repeat(500)}`;
    const related = Array.from({ length: 6 }, (_, index) => [
      `lib-${index}.js`,
      `export const n${index} = ${index};\n${'z'.repeat(1800)}`,
    ] as [string, string]);
    const oversized = Array.from({ length: 12 }, (_, index) => [
      `bulk-${index}.js`,
      `${'w'.repeat(3000)}\n`,
    ] as [string, string]);
    const importer = `${related
      .map(([path], index) => `import { n${index} } from './${path}';`)
      .join('\n')}\n${editable}`;
    const context = prepareSourceContext({
      files: files([
        ['app.js', importer],
        ['package.json', instruction],
        ...related,
        ...oversized,
      ]),
      allowedPaths: ['app.js', 'package.json', ...related.map(([path]) => path), ...oversized.map(([path]) => path)],
      protectedPaths: ['.env', 'secrets/token'],
      intendedChange: 'Keep the importer heading.',
    });
    const stats = providerRequestContentStats(context);
    expect(context.editable.length).toBeGreaterThan(0);
    expect(context.editable.length).toBeLessThanOrEqual(SOURCE_CONTEXT_BUDGET.maxEditableFiles);
    expect(context.editable.reduce((total, file) => total + file.content.length, 0)).toBeLessThanOrEqual(
      SOURCE_CONTEXT_BUDGET.maxEditableTotalBytes,
    );
    expect(stats.excerptFileCount).toBeLessThanOrEqual(SOURCE_CONTEXT_BUDGET.maxExcerptFiles);
    expect(stats.excerptBytes).toBeLessThanOrEqual(SOURCE_CONTEXT_BUDGET.maxExcerptTotalBytes);
    expect(stats.smuggledManifestExcerpts).toBe(0);
    const prompt = JSON.parse(providerPromptText(context)) as {
      files: Array<{ path: string; content: string; editable: boolean }>;
      manifest: Array<{ path: string; excerpt: string | null }>;
    };
    expect(prompt.files.filter((file) => file.editable).map((file) => file.path)).toEqual(
      context.editable.map((file) => file.path),
    );
    expect(prompt.manifest.every((entry) => entry.excerpt === null)).toBe(true);
    expect(prompt.files.every((file) => file.path !== '.env')).toBe(true);
  });
});
