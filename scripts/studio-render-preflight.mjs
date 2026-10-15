#!/usr/bin/env node
/**
 * Renderer/font preflight for the Studio worker package.
 * Does not commission hosting or print secrets.
 */
import { build } from 'rolldown';
import { mkdtemp, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const work = await mkdtemp(join(root, '.studio-preflight-'));
const outfile = join(work, 'preflight.mjs');
try {
  await build({
    cwd: root,
    input: join(root, 'src/domains/studio/render/preflight.ts'),
    platform: 'node',
    resolve: { alias: { '@': join(root, 'src') } },
    external: (id) => {
      if (id.startsWith('@/') || id.startsWith('.') || id.startsWith('/') || id.startsWith('\0')) return false;
      return !id.startsWith(root);
    },
    output: { file: outfile, format: 'esm', sourcemap: false },
  });
  const loaded = await import(outfile);
  const report = await loaded.rendererPreflight();
  console.log(
    JSON.stringify(
      {
        ok: report.ok,
        libx264: report.libx264,
        ffmpegVersion: report.ffmpeg?.version ?? null,
        fonts: report.fonts.map((font) => ({ id: font.id, weight: font.weight, present: font.present })),
        raster: report.raster,
        rasterError: report.rasterError,
        designExport: report.designExport,
        film: report.film,
        note: report.note,
      },
      null,
      2,
    ),
  );
  await rm(work, { recursive: true, force: true }).catch(() => undefined);
  process.exit(report.ok ? 0 : 1);
} catch (error) {
  await rm(work, { recursive: true, force: true }).catch(() => undefined);
  console.error(error instanceof Error ? error.message : 'Studio render preflight failed.');
  process.exit(1);
}
