import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executeWorkerImageBuild } from './architect-apps-worker-image.mjs';
import { defaultPackagedWorkRoot, preparePackagedWorkRoot } from './architect-apps-packaged-worker.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const toolchain = process.env.ARCHITECT_APPS_IMAGE || 'aethelios-architect-apps:2026-10-15.1';
const workRoot = process.env.ARCHITECT_APPS_WORK_ROOT || defaultPackagedWorkRoot;

function requireImage(name) {
  const inspected = spawnSync('docker', ['image', 'inspect', '--format', '{{.Id}}', name], { encoding: 'utf8' });
  if (inspected.status !== 0 || !inspected.stdout.trim().startsWith('sha256:'))
    throw new Error(`Required image ${name} is not present on this runner. Build it before integration checks.`);
  return inspected.stdout.trim();
}

const docker = spawnSync('docker', ['version', '--format', '{{.Server.Version}}'], { encoding: 'utf8' });
if (docker.status !== 0) {
  console.error(JSON.stringify({ ok: false, action: 'unavailable', reason: 'Docker is not available. Isolated Apps checks cannot run here.' }));
  process.exit(process.env.ARCHITECT_APPS_REQUIRE_ISOLATION === 'true' ? 1 : 0);
}

const toolchainBuilt = spawnSync(process.execPath, [join(root, 'scripts/architect-apps-image.mjs')], {
  encoding: 'utf8',
  stdio: 'inherit',
  cwd: root,
});
if (toolchainBuilt.status !== 0) process.exit(toolchainBuilt.status ?? 1);
const worker = executeWorkerImageBuild({ inherit: true });
if (worker.action !== 'built' && worker.action !== 'unavailable') process.exit(worker.status ?? 1);
if (worker.action === 'unavailable') process.exit(process.env.ARCHITECT_APPS_REQUIRE_ISOLATION === 'true' ? 1 : 0);

const toolchainId = requireImage(toolchain);
const workerId = requireImage(worker.image);
const prepared = preparePackagedWorkRoot(workRoot);
if (!prepared.ok) {
  console.error(JSON.stringify({ ok: false, action: 'misconfigured', reason: prepared.reason }));
  process.exit(1);
}

const receipt = {
  ok: true,
  action: 'prepared',
  toolchain: { image: toolchain, id: toolchainId },
  worker: { image: worker.image, id: workerId },
  workRoot: prepared,
};
mkdirSync(join(root, 'docs/evidence/architect-apps'), { recursive: true });
writeFileSync(join(root, 'docs/evidence/architect-apps/runtime-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify(receipt));
