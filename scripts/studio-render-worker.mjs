#!/usr/bin/env node
/**
 * Trusted Studio film worker. Compiles the TypeScript worker graph and runs
 * one tick, or a supervised claim/dispatch loop with --supervised.
 *
 * Requires FFmpeg 6.1+ with libx264 and aac. Uses the service role only on the
 * worker host. Do not expose this process or its credentials to browsers.
 *
 * Environment:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   STUDIO_FFMPEG_PATH=/usr/bin/ffmpeg (optional)
 *   STUDIO_RENDER_WORKER_MODE=supervised (optional)
 *
 * Queue jobs from the app with STUDIO_RENDER_WORKER=true. That flag is not
 * hosted readiness. Do not provision infrastructure or activate a hosted
 * worker from this assignment.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { build } from 'rolldown';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const work = await mkdtemp(join(root, '.studio-worker-'));
const outfile = join(work, 'worker.mjs');
try {
  await build({
    cwd: root,
    input: join(root, 'src/domains/studio/render/worker-entry.ts'),
    platform: 'node',
    resolve: { alias: { '@': join(root, 'src') } },
    external: (id) => {
      if (id.startsWith('@/') || id.startsWith('.') || id.startsWith('/') || id.startsWith('\0'))
        return false;
      return !id.startsWith(root);
    },
    output: {
      file: outfile,
      format: 'esm',
      sourcemap: false,
    },
  });
  const child = spawn(process.execPath, [outfile, ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: process.env,
  });
  const code = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (value) => resolve(value ?? 1));
  });
  await rm(work, { recursive: true, force: true }).catch(() => undefined);
  process.exit(code);
} catch (error) {
  await rm(work, { recursive: true, force: true }).catch(() => undefined);
  console.error(
    `Studio render worker failed to start: ${error instanceof Error ? error.message : 'unavailable'}`,
  );
  process.exit(1);
}
