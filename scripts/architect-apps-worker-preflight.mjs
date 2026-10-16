import { spawnSync } from 'node:child_process';

// Offline release evidence mode never starts the worker (live preflight can report presence).
if (process.argv[2] === '--release-report') {
  const { runReleaseReport } = await import('./architect-apps-release-report.mjs');
  process.exit(runReleaseReport(process.argv.slice(3)));
}

const result = spawnSync(process.execPath, ['scripts/architect-apps-worker.mjs', '--preflight'], {
  encoding: 'utf8',
  env: process.env,
});
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.status ?? 1);
