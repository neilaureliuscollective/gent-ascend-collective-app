import { mkdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const defaultPackagedWorkRoot = '/tmp/architect-apps-work';
export const defaultWorkerImage = process.env.ARCHITECT_APPS_WORKER_IMAGE || 'aethelios-architect-apps-worker:2026-10-15.1';

const secretNames = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'ARCHITECT_CONSTRUCT_WORKER_TOKEN',
  'ARCHITECT_APPS_PREVIEW_SECRET',
  'OPENAI_API_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
];

export function dockerSocketGid(sock = '/var/run/docker.sock', spawn = spawnSync) {
  const inspected = spawn('stat', ['-c', '%g', sock], { encoding: 'utf8' });
  const gid = Number((inspected.stdout ?? '').trim());
  return Number.isInteger(gid) && gid > 0 ? gid : null;
}

export function packagedWorkerInvocation(input = {}) {
  const image = input.image ?? defaultWorkerImage;
  const workRoot = input.workRoot ?? process.env.ARCHITECT_APPS_WORK_ROOT ?? defaultPackagedWorkRoot;
  const sock = input.dockerSock ?? '/var/run/docker.sock';
  const gid = input.dockerGid ?? dockerSocketGid(sock, input.spawn);
  if (!workRoot.startsWith('/') || workRoot.includes('..') || workRoot.includes('docker.sock'))
    throw new Error('Packaged worker work root must be an absolute shared host path.');
  const args = ['run', '--rm'];
  if (input.name) args.push('--name', input.name);
  args.push('--network', 'host');
  if (gid) args.push('--group-add', String(gid));
  args.push('-v', `${sock}:/var/run/docker.sock`, '-v', `${workRoot}:${workRoot}`);
  const env = input.env ?? {};
  const names = [
    'APP_ENV',
    'NODE_ENV',
    'PATH',
    'ARCHITECT_ORIGIN_ENABLED',
    'ARCHITECT_APPS_ENABLED',
    'ARCHITECT_APPS_DEPLOYMENT_MODE',
    'ARCHITECT_APPS_REQUIRE_ISOLATION',
    'ARCHITECT_APPS_IMAGE',
    'ARCHITECT_APPS_IMAGE_DIGEST',
    'ARCHITECT_APPS_WORKER_ID',
    'ARCHITECT_CONSTRUCT_WORKER_ID',
    'ARCHITECT_CONSTRUCT_WORKER_TOKEN',
    'ARCHITECT_APPS_WORKER_HEALTH_PORT',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'ARCHITECT_APPS_PREVIEW_SECRET',
    'ARCHITECT_APPS_STORE',
  ];
  args.push('-e', `ARCHITECT_APPS_WORK_ROOT=${workRoot}`);
  for (const name of names) {
    if (env[name] != null && env[name] !== '') args.push('-e', `${name}=${env[name]}`);
  }
  if (input.once || input.preflight || input.health || input.proveWrite || input.compileFixture)
    args.push('--entrypoint', 'node');
  args.push(image);
  if (input.once) args.push('/opt/architect-apps-worker/apps-worker.mjs');
  if (input.preflight) args.push('/opt/architect-apps-worker/apps-worker.mjs', '--preflight');
  if (input.health) args.push('/opt/architect-apps-worker/apps-worker.mjs', '--health');
  if (input.proveWrite) args.push('/opt/architect-apps-worker/apps-worker.mjs', '--prove-write');
  if (input.compileFixture) args.push('/opt/architect-apps-worker/apps-worker.mjs', '--compile-fixture');
  if (args.some((value) => String(value).includes('OPENAI_API_KEY')))
    throw new Error('Packaged worker must not receive model keys.');
  return { command: 'docker', args, workRoot, image };
}

export function assertPackagedWorkerIsolation(args) {
  const joined = args.join(' ');
  if (!joined.includes('/var/run/docker.sock:/var/run/docker.sock'))
    throw new Error('Packaged worker needs the host Docker socket for sibling compiles.');
  if (!args.includes('--network') || args[args.indexOf('--network') + 1] !== 'host')
    throw new Error('Packaged worker uses host network only to reach the control plane.');
  const work = args.find((value, index) => args[index - 1] === '-e' && value.startsWith('ARCHITECT_APPS_WORK_ROOT='));
  const root = work?.slice('ARCHITECT_APPS_WORK_ROOT='.length);
  if (!root || !joined.includes(`${root}:${root}`))
    throw new Error('Packaged worker must mount the shared work root at the identical host path.');
}

export function packagedWorkerTopologyArgs(input = {}) {
  const workRoot = input.workRoot ?? defaultPackagedWorkRoot;
  const image = input.image ?? defaultWorkerImage;
  const toolchain = input.toolchain ?? 'aethelios-architect-apps:2026-10-15.1';
  const probe = input.probe ?? join(workRoot, 'topology-probe');
  const args = ['run', '--rm', '--network', 'none'];
  if (input.dockerGid) args.push('--group-add', String(input.dockerGid));
  args.push(
    '--user',
    '1000:1000',
    '--entrypoint',
    'docker',
    '-v',
    '/var/run/docker.sock:/var/run/docker.sock',
    '-v',
    `${workRoot}:${workRoot}`,
    '-e',
    `ARCHITECT_APPS_WORK_ROOT=${workRoot}`,
    image,
    'run',
    '--rm',
    '--network',
    'none',
    '--user',
    '65534:65534',
    '-v',
    `${probe}:/probe:ro`,
    toolchain,
    'cat',
    '/probe/marker.txt',
  );
  const imageIndex = args.indexOf(image);
  if (imageIndex < 0 || args[imageIndex + 1] !== 'run')
    throw new Error('Topology proof must invoke the packaged worker image, not a numeric group id.');
  if (args.includes('--privileged') || args.join(' ').includes('OPENAI_API_KEY'))
    throw new Error('Topology proof would expose host authority or secrets.');
  return args;
}

export function provePackagedWorkerTopology(options = {}) {
  const spawn = options.spawn ?? spawnSync;
  const workRoot = options.workRoot ?? process.env.ARCHITECT_APPS_WORK_ROOT ?? defaultPackagedWorkRoot;
  const image = options.image ?? defaultWorkerImage;
  const toolchain = options.toolchain ?? process.env.ARCHITECT_APPS_IMAGE ?? 'aethelios-architect-apps:2026-10-15.1';
  mkdirSync(workRoot, { recursive: true });
  try {
    statSync(workRoot);
  } catch {
    return { ok: false, action: 'unavailable', reason: 'Shared work root could not be created.' };
  }
  const probe = join(workRoot, `topology-${Date.now()}`);
  mkdirSync(probe, { recursive: true });
  writeFileSync(join(probe, 'marker.txt'), 'host-visible-work-root\n');
  const gid = dockerSocketGid('/var/run/docker.sock', spawn);
  const args = packagedWorkerTopologyArgs({ workRoot, image, toolchain, probe, dockerGid: gid });
  const ran = spawn('docker', args, { encoding: 'utf8' });
  const output = `${ran.stdout ?? ''}${ran.stderr ?? ''}`;
  const receipt = {
    ok: ran.status === 0 && /host-visible-work-root/.test(output),
    action: ran.status === 0 ? 'proved' : 'failed',
    workRoot,
    image,
    toolchain,
    command: ['docker', ...args],
    output: output.slice(-1200),
  };
  mkdirSync(join(root, 'docs/evidence/architect-apps'), { recursive: true });
  writeFileSync(join(root, 'docs/evidence/architect-apps/packaged-worker-topology.json'), `${JSON.stringify(receipt, null, 2)}\n`);
  return receipt;
}

export function preparePackagedWorkRoot(workRoot, spawn = spawnSync) {
  mkdirSync(workRoot, { recursive: true });
  const owned = spawn('stat', ['-c', '%u %g %a', workRoot], { encoding: 'utf8' });
  const [uid, gid, mode] = (owned.stdout ?? '').trim().split(/\s+/);
  if (uid === '1000' && mode !== '777' && mode !== '0777') return { ok: true, uid, gid, mode, workRoot };
  const installed = spawn('sudo', ['-n', 'install', '-d', '-o', '1000', '-g', '1000', '-m', '0755', workRoot], {
    encoding: 'utf8',
  });
  if (installed.status !== 0) {
    return {
      ok: false,
      uid,
      gid,
      mode,
      workRoot,
      reason: `Shared work root must be uid 1000 mode 0755. Prepare with: sudo install -d -o 1000 -g 1000 -m 0755 ${workRoot}`,
    };
  }
  return { ok: true, uid: '1000', gid: '1000', mode: '755', workRoot };
}

function passEnv() {
  const env = {};
  for (const name of [
    'APP_ENV',
    'NODE_ENV',
    'ARCHITECT_ORIGIN_ENABLED',
    'ARCHITECT_APPS_ENABLED',
    'ARCHITECT_APPS_DEPLOYMENT_MODE',
    'ARCHITECT_APPS_REQUIRE_ISOLATION',
    'ARCHITECT_APPS_IMAGE',
    'ARCHITECT_APPS_IMAGE_DIGEST',
    'ARCHITECT_APPS_WORKER_ID',
    'ARCHITECT_CONSTRUCT_WORKER_ID',
    'ARCHITECT_CONSTRUCT_WORKER_TOKEN',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'ARCHITECT_APPS_PREVIEW_SECRET',
    'ARCHITECT_APPS_STORE',
    'ARCHITECT_APPS_WORKER_HEALTH_PORT',
    'PATH',
  ]) {
    if (process.env[name]) env[name] = process.env[name];
  }
  return env;
}

const invoked = process.argv[1] && process.argv[1].endsWith('architect-apps-packaged-worker.mjs');
if (invoked) {
  const once = process.argv.includes('--once');
  const preflight = process.argv.includes('--preflight');
  const health = process.argv.includes('--health');
  const topology = process.argv.includes('--prove-topology');
  const proveWrite = process.argv.includes('--prove-write');
  const compileFixture = process.argv.includes('--prove-compile');
  const workRoot = process.env.ARCHITECT_APPS_WORK_ROOT || defaultPackagedWorkRoot;
  const prepared = preparePackagedWorkRoot(workRoot);
  if (!prepared.ok) {
    console.error(JSON.stringify({ ok: false, action: 'misconfigured', reason: prepared.reason }));
    process.exit(1);
  }
  if (topology) {
    const receipt = provePackagedWorkerTopology({ workRoot });
    console.log(JSON.stringify({ ok: receipt.ok, action: receipt.action, workRoot: receipt.workRoot }));
    if (!receipt.ok) {
      console.error(receipt.output || receipt.reason || 'Packaged worker topology proof failed.');
      process.exit(1);
    }
    process.exit(0);
  }
  if (!existsSync('/var/run/docker.sock')) {
    console.error(JSON.stringify({ ok: false, action: 'unavailable', reason: 'Docker socket is not available in this runtime.' }));
    process.exit(process.env.ARCHITECT_APPS_REQUIRE_ISOLATION === 'true' ? 1 : 0);
  }
  const invocation = packagedWorkerInvocation({
    workRoot,
    env: passEnv(),
    once,
    preflight,
    health,
    proveWrite,
    compileFixture,
  });
  assertPackagedWorkerIsolation(invocation.args);
  const ran = spawnSync(invocation.command, invocation.args, { encoding: 'utf8', stdio: 'inherit' });
  process.exit(ran.status ?? 1);
}

void secretNames;
