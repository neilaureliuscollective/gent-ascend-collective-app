import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const defaultWorkerImage = 'aethelios-architect-apps-worker:2026-10-15.1';

export function workerImageName(env = process.env) {
  return env.ARCHITECT_APPS_WORKER_IMAGE || defaultWorkerImage;
}

export function createWorkerImageStage(base = tmpdir()) {
  return mkdtempSync(join(base, 'apps-worker-image-'));
}

export function workerImageBuildArgs(image, stage) {
  return ['build', '-t', image, stage];
}

export function executeWorkerImageBuild(options = {}) {
  const env = options.env ?? process.env;
  const image = options.image ?? workerImageName(env);
  const spawn = options.spawn ?? spawnSync;
  const inspect = spawn('docker', ['version', '--format', '{{.Server.Version}}'], { encoding: 'utf8' });
  if (inspect.status !== 0) {
    const receipt = {
      image,
      action: 'unavailable',
      reason: 'Docker is not available in this runtime. The worker image was not built here.',
      status: 0,
    };
    if (!options.silent) console.log(JSON.stringify({ image: receipt.image, action: receipt.action, reason: receipt.reason }));
    return receipt;
  }
  const stage = createWorkerImageStage(options.stageRoot ?? tmpdir());
  try {
    const bundleOut = join(stage, 'apps-worker.mjs');
    const bundled = spawn(process.execPath, [join(root, 'scripts/architect-apps-worker.mjs'), `--bundle-out=${bundleOut}`], {
      encoding: 'utf8',
      stdio: options.inherit === false ? 'pipe' : 'inherit',
      cwd: root,
    });
    if (bundled.status !== 0) {
      const receipt = { image, action: 'missing', reason: 'Worker bundle failed.', status: bundled.status ?? 1 };
      if (!options.silent) console.error(JSON.stringify({ image, action: receipt.action, reason: receipt.reason }));
      return receipt;
    }
    cpSync(join(root, 'deploy/architect-apps/worker/Dockerfile'), join(stage, 'Dockerfile'));
    cpSync(join(root, 'deploy/architect-apps/worker/entrypoint.sh'), join(stage, 'entrypoint.sh'));
    const buildArgs = workerImageBuildArgs(image, stage);
    const built = spawn('docker', buildArgs, {
      encoding: 'utf8',
      stdio: options.inherit === false ? 'pipe' : 'inherit',
    });
    if (built.status !== 0) {
      const receipt = { image, action: 'missing', reason: 'Worker image build failed.', status: built.status ?? 1, command: ['docker', ...buildArgs] };
      if (!options.silent) console.error(JSON.stringify({ image, action: receipt.action, reason: receipt.reason }));
      return receipt;
    }
    const after = spawn('docker', ['image', 'inspect', '--format', '{{.Id}}', image], { encoding: 'utf8' });
    const receipt = { image, id: (after.stdout ?? '').trim(), action: 'built', status: 0, command: ['docker', ...buildArgs] };
    if (!options.silent) {
      mkdirSync(join(root, 'docs/evidence/architect-apps'), { recursive: true });
      writeFileSync(join(root, 'docs/evidence/architect-apps/worker-image-receipt.json'), `${JSON.stringify({ image: receipt.image, id: receipt.id, action: receipt.action }, null, 2)}\n`);
      console.log(JSON.stringify({ image: receipt.image, id: receipt.id, action: receipt.action }));
    }
    return receipt;
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

const invokedDirectly = Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (invokedDirectly) {
  const receipt = executeWorkerImageBuild();
  process.exit(receipt.status ?? 1);
}
