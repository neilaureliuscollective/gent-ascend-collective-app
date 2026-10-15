import { spawnSync } from 'node:child_process';

const image = process.env.ARCHITECT_APPS_IMAGE || 'aethelios-architect-apps:2026-10-15.1';
const inspect = spawnSync('docker', ['image', 'inspect', '--format', '{{.Id}}', image], { encoding: 'utf8' });
if (inspect.status === 0 && inspect.stdout.trim()) {
  console.log(JSON.stringify({ image, id: inspect.stdout.trim(), action: 'present' }));
  process.exit(0);
}
const built = spawnSync('docker', ['build', '-t', image, 'deploy/architect-apps'], {
  encoding: 'utf8',
  stdio: 'inherit',
});
if (built.status !== 0) {
  console.error(
    JSON.stringify({
      image,
      action: 'missing',
      reason: 'Docker could not build the pinned Architect Apps image. Isolated success stays unavailable.',
    }),
  );
  process.exit(built.status ?? 1);
}
const after = spawnSync('docker', ['image', 'inspect', '--format', '{{.Id}}', image], { encoding: 'utf8' });
console.log(JSON.stringify({ image, id: after.stdout.trim(), action: 'built' }));
