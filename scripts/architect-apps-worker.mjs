// Compiles the server-only Apps worker graph and runs one durable tick,
// a supervised loop, preflight, or health report. Values are never printed.
import { mkdtemp, rm } from 'node:fs/promises';
import { builtinModules } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { build } from 'rolldown';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const bundleArg = process.argv.find((value) => value.startsWith('--bundle-out='));
const bundleOut = bundleArg?.slice('--bundle-out='.length) || process.env.ARCHITECT_APPS_WORKER_BUNDLE;
const builtins = new Set([...builtinModules, ...builtinModules.map((name) => `node:${name}`)]);
const work = bundleOut ? null : await mkdtemp(join(root, '.apps-worker-'));
const outfile = bundleOut || join(work, 'worker.mjs');
const childArgs = process.argv.slice(2).filter((value) => !value.startsWith('--bundle-out='));

try {
  await build({
    cwd: root,
    input: join(root, 'src/domains/architect-apps/worker-entry.ts'),
    platform: 'node',
    resolve: { alias: { '@': join(root, 'src') } },
    external: (id) => builtins.has(id),
    output: {
      file: outfile,
      format: 'esm',
      sourcemap: false,
    },
  });
  if (bundleOut) {
    console.log(JSON.stringify({ action: 'bundled', file: outfile }));
    process.exit(0);
  }
  const child = spawn(process.execPath, [outfile, ...childArgs], {
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
  if (work) await rm(work, { recursive: true, force: true }).catch(() => undefined);
  console.error(`Apps worker failed to start: ${error instanceof Error ? error.message : 'unavailable'}`);
  process.exit(1);
}
