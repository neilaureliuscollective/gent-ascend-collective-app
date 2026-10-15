#!/usr/bin/env node
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'rolldown';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outfile = join(root, 'dist', 'studio-worker.mjs');
await mkdir(join(root, 'dist'), { recursive: true });
await build({
  cwd: root,
  input: join(root, 'src/domains/studio/render/worker-entry.ts'),
  platform: 'node',
  resolve: { alias: { '@': join(root, 'src') } },
  external: (id) => {
    if (id.startsWith('@/') || id.startsWith('.') || id.startsWith('/') || id.startsWith('\0')) return false;
    return !id.startsWith(root);
  },
  output: { file: outfile, format: 'esm', sourcemap: false },
});
console.log(`Wrote ${outfile}`);
