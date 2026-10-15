import { spawnSync } from 'node:child_process';

const result = spawnSync(process.execPath, ['scripts/architect-apps-worker.mjs', '--health'], {
  encoding: 'utf8',
  env: process.env,
});
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.status ?? 1);
