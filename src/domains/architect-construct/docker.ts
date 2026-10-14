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

export const constructNobody = '65534:65534';
export const tmpfsWork = '/work:rw,exec,nosuid,size=64m,uid=65534,gid=65534,mode=0755';
export const tmpfsTmp = '/tmp:rw,noexec,nosuid,size=16m,uid=65534,gid=65534,mode=1777';
export const tmpfsOut = '/out:rw,noexec,nosuid,size=8m,uid=65534,gid=65534,mode=0755';

export function dockerInvocation(
  snapshotDir: string,
  runnerFile: string,
  image = defaultConstructImage,
  mounts: { jobFile?: string; outDir?: string; name?: string } = {},
) {
  const paths = [snapshotDir, runnerFile, mounts.jobFile, mounts.outDir].filter(Boolean) as string[];
  if (paths.some((path) => path.includes('docker.sock')))
    throw new Error('Docker socket paths are not permitted.');
  if (mounts.name && !/^construct-[A-Za-z0-9_-]+$/.test(mounts.name))
    throw new Error('Disposable container names must stay inside the construct- prefix.');
  const args = [
    'run',
    '--rm',
    '--network',
    'none',
    '--read-only',
    '--tmpfs',
    tmpfsWork,
    '--tmpfs',
    tmpfsTmp,
    '--user',
    constructNobody,
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
  else args.push('--tmpfs', tmpfsOut);
  if (mounts.name) args.push('--name', mounts.name);
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
  if (args[args.indexOf('--user') + 1] !== constructNobody)
    throw new Error('Docker isolation must run as the nobody identity 65534:65534.');
  const work = args[args.indexOf('--tmpfs') + 1] ?? '';
  if (!work.startsWith('/work:') || !work.includes('uid=65534') || !work.includes('gid=65534'))
    throw new Error('Writable /work tmpfs must be owned by nobody.');
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

export const trustedContainerRunner = `import { accessSync, constants, existsSync, lstatSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
function can(path, mode) { try { accessSync(path, mode); return true; } catch { return false; } }
function describe(path) {
  try {
    const st = statSync(path);
    return { path, uid: st.uid, gid: st.gid, mode: (st.mode & 0o777).toString(8), readable: can(path, constants.R_OK), writable: can(path, constants.W_OK) };
  } catch (error) {
    return { path, error: error.code || String(error.message || error) };
  }
}
const job = JSON.parse(readFileSync('/opt/construct-job.json', 'utf8'));
const firstSource = job.files && job.files[0] && job.files[0].path ? join('/src', job.files[0].path) : '/src';
const workspace = {
  identity: { uid: process.getuid ? process.getuid() : null, gid: process.getgid ? process.getgid() : null },
  src: describe('/src'),
  source_file: describe(firstSource),
  work: describe('/work'),
  tmp: describe('/tmp'),
  out: describe('/out'),
};
process.stderr.write('CONSTRUCT_WORKSPACE ' + JSON.stringify(workspace) + '\\n');
if (workspace.identity.uid !== 65534 || workspace.identity.gid !== 65534)
  throw new Error('Container is not running as nobody 65534:65534.');
if (!workspace.source_file.readable)
  throw new Error('Pinned source is not readable by the nobody identity.');
if (workspace.source_file.writable)
  throw new Error('Pinned source must stay immutable.');
if (!workspace.work.writable || workspace.work.uid !== 65534)
  throw new Error('Writable /work tmpfs is not owned by nobody.');
const work = '/work';
for (const file of job.files) {
  const to = join(work, file.path);
  mkdirSync(dirname(to), { recursive: true });
  writeFileSync(to, readFileSync(join('/src', file.path)));
}
function runJobChecks() {
  const results = [];
  for (const check of job.checks || []) {
    const ran = spawnSync(check.command, check.args, {
      cwd: work,
      encoding: 'utf8',
      env: { PATH: '/usr/local/bin:/usr/bin:/bin', HOME: work, NODE_ENV: 'test', NODE_OPTIONS: '' },
      timeout: Math.min(8000, job.timeout_ms || 8000),
    });
    results.push({
      name: check.name,
      command: [check.command, ...check.args].join(' '),
      exit_code: ran.status ?? 1,
      status: ran.status === 0 ? 'passed' : 'failed',
      log: ((ran.stdout || '') + (ran.stderr || '')).slice(0, 16384),
    });
  }
  return results;
}
const baseline_checks = runJobChecks();
for (const patch of job.patch) {
  const target = join(work, patch.path);
  if (!existsSync(target)) throw new Error('Creating files is not supported in this pass.');
  if (readFileSync(target, 'utf8') !== patch.before) throw new Error('Patch basis mismatch');
  writeFileSync(target, patch.after);
}
const checks = runJobChecks();
const allowed = Array.isArray(job.allowed_paths) ? job.allowed_paths : [];
const files = [];
for (const rel of allowed) {
  const target = join(work, rel);
  if (!existsSync(target)) continue;
  const st = lstatSync(target);
  if (st.isSymbolicLink()) throw new Error('Observed output contained a symbolic link.');
  const content = readFileSync(target, 'utf8');
  files.push({ path: rel, content });
  try {
    const outFile = join('/out/files', rel);
    mkdirSync(dirname(outFile), { recursive: true });
    writeFileSync(outFile, content);
  } catch { /* /out is optional */ }
}
const previewPath = job.previewPath || null;
const previewFile = files.find((file) => file.path === previewPath);
const preview = {
  path: previewPath,
  body: previewFile ? previewFile.content : '',
  unavailable_reason: previewPath ? (previewFile ? null : 'Observed preview file was not present.') : 'No preview path was included in this brief.',
};
const changed_files = files.filter((file) => {
  const original = existsSync(join('/src', file.path)) ? readFileSync(join('/src', file.path), 'utf8') : '';
  return original !== file.content;
}).map((file) => file.path);
const payload = { checks, baseline_checks, files, changed_files, preview };
try { writeFileSync('/out/result.json', JSON.stringify(payload)); } catch { /* /out is optional */ }
process.stdout.write('CONSTRUCT_RESULT_BEGIN\\n' + JSON.stringify(payload) + '\\nCONSTRUCT_RESULT_END\\n');
`;

export function parseWorkspaceDiagnostics(stderr: string) {
  const line = stderr.split('\n').find((entry) => entry.startsWith('CONSTRUCT_WORKSPACE '));
  if (!line) return null;
  try {
    return JSON.parse(line.slice('CONSTRUCT_WORKSPACE '.length));
  } catch {
    return null;
  }
}

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
