import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const constructImageName = 'ARCHITECT_CONSTRUCT_IMAGE';
export const defaultConstructImage = 'node:24-alpine';
export const resultFenceStart = 'CONSTRUCT_RESULT_BEGIN';
export const resultFenceEnd = 'CONSTRUCT_RESULT_END';

export type IsolationUnavailableCode =
  | 'not-installed'
  | 'daemon-unavailable'
  | 'timeout'
  | 'empty-version'
  | 'error';

export type IsolationProbe =
  | { available: true; backend: 'docker'; version: string; image: string; code: 'available'; reason: null }
  | { available: false; backend: 'unavailable'; code: IsolationUnavailableCode; reason: string };

export type DockerExec = (
  file: string,
  args: readonly string[],
  options: { timeout: number; env?: NodeJS.ProcessEnv },
) => Promise<{ stdout: string; stderr?: string }>;

export function dockerInvocation(
  snapshotDir: string,
  runnerFile: string,
  image = defaultConstructImage,
  mounts: { jobFile?: string; outDir?: string } = {},
) {
  const paths = [snapshotDir, runnerFile, mounts.jobFile, mounts.outDir].filter(Boolean) as string[];
  if (paths.some((path) => path.includes('docker.sock')))
    throw new Error('Docker socket paths are not permitted.');
  const args = [
    'run',
    '--rm',
    '--network',
    'none',
    '--read-only',
    '--tmpfs',
    '/work:rw,exec,nosuid,size=64m',
    '--tmpfs',
    '/tmp:rw,noexec,nosuid,size=16m',
    '--user',
    '65534:65534',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '--memory',
    '256m',
    '--cpus',
    '1',
    '--pids-limit',
    '64',
    '-e',
    'PATH=/usr/local/bin:/usr/bin:/bin',
    '-e',
    'HOME=/work',
    '-e',
    'NODE_ENV=test',
    '-v',
    `${snapshotDir}:/src:ro`,
    '-v',
    `${runnerFile}:/opt/construct-runner.mjs:ro`,
  ];
  if (mounts.jobFile) args.push('-v', `${mounts.jobFile}:/opt/construct-job.json:ro`);
  if (mounts.outDir) args.push('-v', `${mounts.outDir}:/out:rw`);
  args.push('-w', '/work', image, 'node', '/opt/construct-runner.mjs');
  return { command: 'docker', args };
}

export function assertSafeDockerArgs(args: string[]) {
  const joined = args.join(' ');
  if (
    joined.includes('docker.sock') ||
    joined.includes('--privileged') ||
    joined.includes('--network host') ||
    joined.includes('OPENAI_API_KEY') ||
    joined.includes('SUPABASE_SERVICE_ROLE_KEY') ||
    joined.includes('ARCHITECT_CONSTRUCT_WORKER_TOKEN')
  )
    throw new Error('Docker invocation would expose host authority or secrets.');
  if (!args.includes('--network') || args[args.indexOf('--network') + 1] !== 'none')
    throw new Error('Docker isolation requires --network none.');
}

export function classifyDockerProbeError(error: unknown): IsolationProbe {
  const code = (error as NodeJS.ErrnoException).code;
  const message = error instanceof Error ? error.message : 'unknown error';
  if (code === 'ENOENT')
    return {
      available: false,
      backend: 'unavailable',
      code: 'not-installed',
      reason: 'Docker is not installed in this runtime. Isolated container execution is blocked.',
    };
  if (
    code === 'ETIMEDOUT' ||
    message.includes('ETIMEDOUT') ||
    /timed? ?out/i.test(message)
  )
    return {
      available: false,
      backend: 'unavailable',
      code: 'timeout',
      reason: 'Docker probe timed out before the engine answered.',
    };
  if (
    code === 'ECONNREFUSED' ||
    /cannot connect to the docker daemon/i.test(message) ||
    /is the docker daemon running/i.test(message)
  )
    return {
      available: false,
      backend: 'unavailable',
      code: 'daemon-unavailable',
      reason: 'Docker executable is present but the daemon is unavailable.',
    };
  return {
    available: false,
    backend: 'unavailable',
    code: 'error',
    reason: `Docker isolation is unavailable: ${message}`,
  };
}

export async function inspectConstructImage(
  image: string,
  exec: DockerExec = (file, args, options) => execFileAsync(file, args, options),
): Promise<{ ready: boolean; reason: string | null }> {
  try {
    await exec('docker', ['image', 'inspect', image], { timeout: 8000 });
    return { ready: true, reason: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'image inspect failed';
    return { ready: false, reason: `Construct image ${image} is not present: ${message}` };
  }
}

export async function ensureConstructImage(
  image: string,
  exec: DockerExec = (file, args, options) => execFileAsync(file, args, options),
): Promise<{ ready: boolean; reason: string | null; pulled: boolean }> {
  const present = await inspectConstructImage(image, exec);
  if (present.ready) return { ready: true, reason: null, pulled: false };
  try {
    await exec('docker', ['pull', image], { timeout: 60000 });
    const after = await inspectConstructImage(image, exec);
    return {
      ready: after.ready,
      reason: after.ready ? null : after.reason,
      pulled: after.ready,
    };
  } catch (error) {
    return {
      ready: false,
      pulled: false,
      reason: `Construct image ${image} could not be pulled: ${error instanceof Error ? error.message : 'unknown error'}`,
    };
  }
}

export async function probeDockerIsolation(
  env: NodeJS.ProcessEnv = process.env,
  exec: DockerExec = (file, args, options) => execFileAsync(file, args, options),
): Promise<IsolationProbe> {
  const image = env[constructImageName] || defaultConstructImage;
  try {
    const { stdout } = await exec('docker', ['version', '--format', '{{.Server.Version}}'], {
      timeout: 4000,
      env: { PATH: env.PATH ?? '/usr/local/bin:/usr/bin:/bin' } as unknown as NodeJS.ProcessEnv,
    });
    const version = stdout.trim();
    if (!version)
      return {
        available: false,
        backend: 'unavailable',
        code: 'empty-version',
        reason: 'Docker is present but reported no engine version.',
      };
    return { available: true, backend: 'docker', version, image, code: 'available', reason: null };
  } catch (error) {
    return classifyDockerProbeError(error);
  }
}

export const trustedContainerRunner = `import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
const job = JSON.parse(readFileSync('/opt/construct-job.json', 'utf8'));
const work = '/work';
for (const file of job.files) {
  const to = join(work, file.path);
  mkdirSync(dirname(to), { recursive: true });
  cpSync(join('/src', file.path), to);
}
for (const patch of job.patch) {
  const target = join(work, patch.path);
  if (readFileSync(target, 'utf8') !== patch.before) throw new Error('Patch basis mismatch');
  writeFileSync(target, patch.after);
}
const checks = [];
for (const check of job.checks) {
  const ran = spawnSync(check.command, check.args, {
    cwd: work,
    encoding: 'utf8',
    env: { PATH: '/usr/local/bin:/usr/bin:/bin', HOME: work, NODE_ENV: 'test', NODE_OPTIONS: '' },
    timeout: Math.min(8000, job.timeout_ms || 8000),
  });
  checks.push({
    name: check.name,
    command: [check.command, ...check.args].join(' '),
    exit_code: ran.status ?? 1,
    status: ran.status === 0 ? 'passed' : 'failed',
    log: ((ran.stdout || '') + (ran.stderr || '')).slice(0, 16384),
  });
}
const previewPath = job.previewPath || null;
const preview = { path: previewPath, body: '', unavailable_reason: previewPath ? null : 'No preview path was included in this brief.' };
if (previewPath && existsSync(join(work, previewPath))) preview.body = readFileSync(join(work, previewPath), 'utf8');
const payload = { checks, changed_files: job.patch.map((file) => file.path), preview };
try { writeFileSync('/out/result.json', JSON.stringify(payload)); } catch { /* /out is optional */ }
process.stdout.write('CONSTRUCT_RESULT_BEGIN\\n' + JSON.stringify(payload) + '\\nCONSTRUCT_RESULT_END\\n');
`;

export function parseContainerResult(stdout: string) {
  const start = stdout.indexOf(resultFenceStart);
  const end = stdout.indexOf(resultFenceEnd);
  if (start < 0 || end < 0 || end <= start) return null;
  try {
    return JSON.parse(stdout.slice(start + resultFenceStart.length, end).trim());
  } catch {
    return null;
  }
}
