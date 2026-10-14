// Compiles the server-only worker graph and runs one durable tick, or a
// supervised loop when ARCHITECT_CONSTRUCT_WORKER_MODE=supervised or --supervised.
// Native --experimental-strip-types cannot rewrite @/ aliases or parameter properties.
import { mkdtemp, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { build } from 'rolldown';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const work = await mkdtemp(join(root, '.construct-worker-'));
const outfile = join(work, 'worker.mjs');
try {
  await build({
    cwd: root,
    input: join(root, 'src/domains/architect-construct/worker-entry.ts'),
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
    `Construct worker failed to start: ${error instanceof Error ? error.message : 'unavailable'}`,
  );
  process.exit(1);
}
