import { test, expect } from '@playwright/test';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import { readFile, readdir, mkdir, copyFile } from 'node:fs/promises';

test('app-wide charcoal route coverage preserves real access states and reflow', async () => {
  const output = 'test-results/charcoal-routes';
  await mkdir(output, { recursive: true });
  for (const name of await readdir('docs/evidence/charcoal-pass')) {
    if (name.startsWith('before-'))
      await copyFile(`docs/evidence/charcoal-pass/${name}`, `${output}/${name}`);
  }
  await promisify(execFile)(
    process.execPath,
    ['--experimental-strip-types', 'scripts/capture-charcoal-routes.mjs'],
    {
      env: { ...process.env, MATERIAL_PHASE: 'after', MATERIAL_OUTPUT_DIR: output },
      timeout: 285000,
      maxBuffer: 2 * 1024 * 1024,
    },
  );
  const matrix = JSON.parse(await readFile(`${output}/after-matrix.json`, 'utf8')) as {
    commit: string;
    rows: {
      route: string;
      visibleContent: string;
      label: string;
      unavailable?: string;
      errors: string[];
      overflow?: boolean;
      tokens?: Record<string, string>;
      screenshot?: { path: string; bytes: number; sha256: string };
      viewport: { width: number; height: number };
      surfaces: { className: string; background: string }[];
    }[];
  };
  expect(matrix.commit).toBe(
    execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  );
  expect(matrix.rows).toHaveLength(86);
  for (const row of matrix.rows) {
    expect(row.unavailable, `${row.route} ${row.label}`).toBeUndefined();
    expect(row.errors, `${row.route} ${row.label}`).toEqual([]);
    expect(row.overflow, `${row.route} ${row.label}`).toBe(false);
    expect(row.visibleContent, `${row.route} ${row.label}`).not.toMatch(
      /Loading your (companies|selection)…/,
    );
    const environment = row.tokens?.['--io-environment']
      ?.trim()
      .replace(/^#([a-f0-9])([a-f0-9])([a-f0-9])$/i, '#$1$1$2$2$3$3');
    expect(environment, row.route).toBe('#111111');
    for (const surface of row.surfaces.filter((surface) =>
      surface.className.includes('member-lifestyle-focal'),
    )) {
      expect(surface.background).toContain('rgba(36, 36, 36');
      expect(surface.background).not.toContain('rgb(22, 63, 53)');
    }
    if (row.screenshot) {
      const bytes = await readFile(`${output}/${row.screenshot.path}`);
      expect(bytes.length).toBe(row.screenshot.bytes);
      expect(bytes.length).toBeGreaterThan(1000);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(row.screenshot.sha256);
      const png = PNG.sync.read(bytes);
      expect({ width: png.width, height: png.height }).toEqual(row.viewport);
    }
  }
});
