import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { mkdtempSync } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const image = process.env.ARCHITECT_APPS_WORKER_IMAGE || 'aethelios-architect-apps-worker:2026-10-15.1';
const inspect = spawnSync('docker', ['version', '--format', '{{.Server.Version}}'], { encoding: 'utf8' });
if (inspect.status !== 0) {
  console.log(
    JSON.stringify({
      image,
      action: 'unavailable',
      reason: 'Docker is not available in this runtime. The worker image was not built here.',
    }),
  );
  process.exit(0);
}

const stage = mkdtempSync(join(process.cwd(), '.apps-worker-image-'));
try {
  const bundled = spawnSync(process.execPath, ['scripts/architect-apps-worker.mjs', `--bundle-out=${join(stage, 'apps-worker.mjs')}`], {
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (bundled.status !== 0) {
    console.error(JSON.stringify({ image, action: 'missing', reason: 'Worker bundle failed.' }));
    process.exit(bundled.status ?? 1);
  }
  cpSync('deploy/architect-apps/worker/Dockerfile', join(stage, 'Dockerfile'));
  cpSync('deploy/architect-apps/worker/entrypoint.sh', join(stage, 'entrypoint.sh'));
  const built = spawnSync('docker', ['build', '-t', image, stage], {
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (built.status !== 0) {
    console.error(JSON.stringify({ image, action: 'missing', reason: 'Worker image build failed.' }));
    process.exit(built.status ?? 1);
  }
  const after = spawnSync('docker', ['image', 'inspect', '--format', '{{.Id}}', image], { encoding: 'utf8' });
  const receipt = { image, id: after.stdout.trim(), action: 'built' };
  mkdirSync('docs/evidence/architect-apps', { recursive: true });
  writeFileSync('docs/evidence/architect-apps/worker-image-receipt.json', `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(JSON.stringify(receipt));
} finally {
  rmSync(stage, { recursive: true, force: true });
}
