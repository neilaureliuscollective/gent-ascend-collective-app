import { execFile, spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { APP_TOOLCHAIN_VERSION, approvedDependencies } from './catalog';
import { artifactManifestHash } from './hash';
import { assertSingleBundleArtifacts } from './bundle';
import type { AppFile, AppJobResult } from './schema';
import { overlaySealedFiles } from './tree';
import { parseAppsImageDigest } from './commission';

export { parseAppsImageDigest };

const execFileAsync = promisify(execFile);

export const appsImageName = 'ARCHITECT_APPS_IMAGE';
export const defaultAppsImage = 'aethelios-architect-apps:2026-10-15.1';
export const appsNobody = '65534:65534';
export const appsResultFenceStart = 'APPS_RESULT_BEGIN';
export const appsResultFenceEnd = 'APPS_RESULT_END';
export const appsTmpfsWork = '/work:rw,exec,nosuid,size=256m,uid=65534,gid=65534,mode=0755';
export const appsTmpfsTmp = '/tmp:rw,noexec,nosuid,size=64m,uid=65534,gid=65534,mode=1777';
export const appsTmpfsOut = '/out:rw,noexec,nosuid,size=32m,uid=65534,gid=65534,mode=0755';

export type AppsDockerExec = (
  file: string,
  args: readonly string[],
  options: { timeout: number; env?: NodeJS.ProcessEnv },
) => Promise<{ stdout: string; stderr?: string }>;

export type IsolationUnavailableCode =
  | 'not-installed'
  | 'daemon-unavailable'
  | 'timeout'
  | 'empty-version'
  | 'image-missing'
  | 'toolchain-mismatch'
  | 'error';

export type AppsIsolationProbe =
  | { available: true; backend: 'docker'; version: string; image: string; code: 'available'; reason: null }
  | { available: false; backend: 'unavailable'; code: IsolationUnavailableCode; reason: string };

export function appsImage(env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env) {
  return env[appsImageName] || defaultAppsImage;
}

export async function inspectAppsImageDigest(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
  exec: AppsDockerExec = (file, args, options) => execFileAsync(file, args, options),
) {
  try {
    const { stdout } = await exec('docker', ['image', 'inspect', '--format', '{{.Id}}', appsImage(env)], {
      timeout: 4000,
      env: { PATH: env.PATH ?? '/usr/local/bin:/usr/bin:/bin' } as unknown as NodeJS.ProcessEnv,
    });
    return parseAppsImageDigest(stdout.trim());
  } catch {
    return null;
  }
}

export function appsDockerInvocation(
  snapshotDir: string,
  runnerFile: string,
  image = defaultAppsImage,
  mounts: { jobFile?: string; outDir?: string; name?: string } = {},
) {
  const paths = [snapshotDir, runnerFile, mounts.jobFile, mounts.outDir].filter(Boolean) as string[];
  if (paths.some((path) => path.includes('docker.sock'))) throw new Error('Docker socket paths are not permitted.');
  if (mounts.name && !/^apps-[A-Za-z0-9_-]+$/.test(mounts.name))
    throw new Error('Disposable container names must stay inside the apps- prefix.');
  const args = [
    'run',
    '--network',
    'none',
    '--read-only',
    '--tmpfs',
    appsTmpfsWork,
    '--tmpfs',
    appsTmpfsTmp,
    '--tmpfs',
    appsTmpfsOut,
    '--user',
    appsNobody,
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '--memory',
    '1024m',
    '--cpus',
    '2',
    '--pids-limit',
    '128',
    '-e',
    'PATH=/usr/local/bin:/usr/bin:/bin',
    '-e',
    'HOME=/work',
    '-e',
    'NODE_ENV=production',
    '-v',
    `${snapshotDir}:/src:ro`,
    '-v',
    `${runnerFile}:/opt/apps-runner.mjs:ro`,
  ];
  if (mounts.jobFile) args.push('-v', `${mounts.jobFile}:/opt/apps-job.json:ro`);
  if (mounts.outDir) args.push('-v', `${mounts.outDir}:/out:rw`);
  if (mounts.name) args.push('--name', mounts.name);
  args.push('-w', '/work', image, 'node', '/opt/apps-runner.mjs');
  return { command: 'docker', args };
}

export function assertSafeAppsDockerArgs(args: string[]) {
  const joined = args.join(' ');
  if (
    joined.includes('docker.sock') ||
    joined.includes('--privileged') ||
    joined.includes('--network host') ||
    joined.includes('OPENAI_API_KEY') ||
    joined.includes('SUPABASE_SERVICE_ROLE_KEY') ||
    joined.includes('ARCHITECT_CONSTRUCT_WORKER_TOKEN') ||
    joined.includes('ARCHITECT_APPS_PREVIEW_SECRET')
  )
    throw new Error('Docker invocation would expose host authority or secrets.');
  if (!args.includes('--network') || args[args.indexOf('--network') + 1] !== 'none')
    throw new Error('Docker isolation requires --network none.');
  if (args[args.indexOf('--user') + 1] !== appsNobody)
    throw new Error('Docker isolation must run as the nobody identity 65534:65534.');
  const work = args[args.indexOf('--tmpfs') + 1] ?? '';
  if (!work.startsWith('/work:') || !work.includes('uid=65534') || !work.includes('gid=65534'))
    throw new Error('Writable /work tmpfs must be owned by nobody.');
}

export function classifyAppsDockerProbeError(error: unknown): AppsIsolationProbe {
  const code = (error as NodeJS.ErrnoException).code;
  const message = error instanceof Error ? error.message : 'unknown error';
  if (code === 'ENOENT')
    return {
      available: false,
      backend: 'unavailable',
      code: 'not-installed',
      reason: 'Docker is not installed in this runtime. Isolated application builds are blocked.',
    };
  if (code === 'ETIMEDOUT' || message.includes('ETIMEDOUT') || /timed? ?out/i.test(message))
    return {
      available: false,
      backend: 'unavailable',
      code: 'timeout',
      reason: 'Docker probe timed out before the engine answered.',
    };
  if (code === 'ECONNREFUSED' || /cannot connect to the docker daemon/i.test(message) || /is the docker daemon running/i.test(message))
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

export async function probeAppsDockerIsolation(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
  exec: AppsDockerExec = (file, args, options) => execFileAsync(file, args, options),
): Promise<AppsIsolationProbe> {
  const image = appsImage(env);
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
    return classifyAppsDockerProbeError(error);
  }
}

export const requiredAppsToolchain = {
  typescript: approvedDependencies.typescript,
  vite: approvedDependencies.vite,
  react: approvedDependencies.react,
} as const;

export function parseAppsToolchainVersions(raw: string) {
  const parsed = JSON.parse(raw) as { typescript?: string; vite?: string; react?: string };
  const ok =
    parsed.typescript === requiredAppsToolchain.typescript &&
    parsed.vite === requiredAppsToolchain.vite &&
    parsed.react === requiredAppsToolchain.react;
  return {
    ok,
    versions: parsed,
    reason: ok
      ? null
      : `Pinned toolchain mismatch. Required ${APP_TOOLCHAIN_VERSION}; image reported ${JSON.stringify(parsed)}.`,
  };
}

export function appsContainerName(jobId: string) {
  const compact = jobId.replace(/-/g, '').slice(0, 20);
  return `apps-${compact || Date.now().toString(36)}`;
}

export function collectArtifactTree(dir: string, prefix = ''): AppFile[] {
  const artifacts: AppFile[] = [];
  if (!existsSync(dir)) return artifacts;
  for (const name of readdirSync(dir)) {
    const relative = prefix ? `${prefix}/${name}` : name;
    const target = join(dir, name);
    const st = statSync(target);
    if (st.isDirectory()) artifacts.push(...collectArtifactTree(target, relative));
    else artifacts.push({ path: relative, content: readFileSync(target, 'utf8') });
  }
  return artifacts;
}

export const isolatedArtifactCollectorModule = `import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
const artifacts = [];
function walk(dir, prefix) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const relative = prefix ? prefix + '/' + name : name;
    const target = join(dir, name);
    const st = statSync(target);
    if (st.isDirectory()) walk(target, relative);
    else artifacts.push({ path: relative, content: readFileSync(target, 'utf8') });
  }
}
walk(process.argv[2], '');
process.stdout.write(JSON.stringify(artifacts));
`;

export async function removeNamedAppsContainer(
  name: string,
  exec: AppsDockerExec = (file, args, options) => execFileAsync(file, args, options),
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): Promise<{ removed: boolean; confirmed: boolean; inspect: string }> {
  if (!/^apps-[A-Za-z0-9_-]+$/.test(name)) throw new Error('Disposable container names must stay inside the apps- prefix.');
  const dockerEnv = { PATH: env.PATH ?? '/usr/local/bin:/usr/bin:/bin' } as unknown as NodeJS.ProcessEnv;
  try {
    await exec('docker', ['rm', '-f', name], { timeout: 4000, env: dockerEnv });
  } catch {
    /* confirm below */
  }
  try {
    const inspected = await exec('docker', ['inspect', '-f', '{{.Name}} {{.State.Running}}', name], {
      timeout: 4000,
      env: dockerEnv,
    });
    return { removed: true, confirmed: false, inspect: inspected.stdout.trim() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const gone = /no such container|not found/i.test(message) || (error as NodeJS.ErrnoException).code === 'ENOENT';
    return { removed: true, confirmed: gone, inspect: message };
  }
}

export const trustedAppsContainerRunner = `import { accessSync, constants, existsSync, mkdirSync, readFileSync, readdirSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
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
function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
const toolchainRoot = existsSync('/opt/apps-toolchain/node_modules') ? '/opt/apps-toolchain/node_modules' : '/opt/apps-toolchain';
const versions = {
  typescript: readJson(join(toolchainRoot, 'typescript/package.json')).version,
  vite: readJson(join(toolchainRoot, 'vite/package.json')).version,
  react: readJson(join(toolchainRoot, 'react/package.json')).version,
};
if (versions.typescript !== '6.0.3' || versions.vite !== '8.3.0' || versions.react !== '19.3.0')
  throw new Error('Pinned toolchain mismatch: ' + JSON.stringify(versions));
const workspace = {
  identity: { uid: process.getuid ? process.getuid() : null, gid: process.getgid ? process.getgid() : null },
  src: describe('/src'),
  work: describe('/work'),
  tmp: describe('/tmp'),
  out: describe('/out'),
  versions,
};
process.stderr.write('APPS_WORKSPACE ' + JSON.stringify(workspace) + '\\n');
if (workspace.identity.uid !== 65534 || workspace.identity.gid !== 65534)
  throw new Error('Container is not running as nobody 65534:65534.');
if (!workspace.src.readable) throw new Error('Pinned source is not readable by the nobody identity.');
if (workspace.src.writable) throw new Error('Pinned source must stay immutable.');
if (!workspace.work.writable || workspace.work.uid !== 65534)
  throw new Error('Writable /work tmpfs is not owned by nobody.');
const job = JSON.parse(readFileSync('/opt/apps-job.json', 'utf8'));
if (job.files.some((file) => file.path === 'Dockerfile' || file.path.endsWith('.dockerfile') || file.path === 'vite.config.ts' && file.generated))
  throw new Error('Model-controlled Dockerfiles and build plugins are prohibited.');
const work = '/work';
for (const file of job.files) {
  const to = join(work, file.path);
  mkdirSync(dirname(to), { recursive: true });
  writeFileSync(to, readFileSync(join('/src', file.path)));
}
mkdirSync(join(work, 'node_modules'), { recursive: true });
if (existsSync(toolchainRoot)) {
  for (const name of readdirSync(toolchainRoot)) {
    const source = join(toolchainRoot, name);
    const destination = join(work, 'node_modules', name);
    if (!existsSync(destination)) {
      try { symlinkSync(source, destination); } catch { /* already linked */ }
    }
  }
}
function run(bin, args, timeout) {
  const ran = spawnSync(process.execPath, [bin, ...args], {
    cwd: work,
    encoding: 'utf8',
    env: { PATH: '/usr/local/bin:/usr/bin:/bin', HOME: work, NODE_ENV: 'production', NODE_PATH: toolchainRoot, NODE_OPTIONS: '' },
    timeout,
  });
  return { ok: ran.status === 0, log: ((ran.stdout || '') + (ran.stderr || '')).slice(0, 12000) };
}
const typecheck = run(join(toolchainRoot, 'typescript/bin/tsc'), ['--noEmit', '-p', 'tsconfig.json'], Math.min(45000, job.timeout_ms || 45000));
const bundle = typecheck.ok
  ? run(join(toolchainRoot, 'vite/bin/vite.js'), ['build'], Math.min(45000, job.timeout_ms || 45000))
  : { ok: false, log: '' };
const artifacts = [];
function walk(dir, prefix) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const relative = prefix ? prefix + '/' + name : name;
    const target = join(dir, name);
    const st = statSync(target);
    if (st.isDirectory()) walk(target, relative);
    else artifacts.push({ path: relative, content: readFileSync(target, 'utf8') });
  }
}
if (bundle.ok) walk(join(work, 'dist'), '');
const payload = { ok: typecheck.ok && bundle.ok, isolation: 'docker', sandbox: true, versions, typecheck, bundle, artifacts };
try { writeFileSync('/out/result.json', JSON.stringify({ ok: payload.ok, isolation: payload.isolation, sandbox: payload.sandbox, versions, typecheck, bundle, artifact_count: artifacts.length })); } catch { /* optional */ }
process.stdout.write('APPS_RESULT_BEGIN\\n' + JSON.stringify(payload) + '\\nAPPS_RESULT_END\\n');
`;

export function parseAppsContainerResult(stdout: string) {
  const start = stdout.indexOf(appsResultFenceStart);
  const end = stdout.indexOf(appsResultFenceEnd);
  if (start < 0 || end < 0 || end <= start) return null;
  try {
    return JSON.parse(stdout.slice(start + appsResultFenceStart.length, end).trim()) as {
      ok: boolean;
      isolation: 'docker';
      sandbox: boolean;
      versions?: { typescript?: string; vite?: string; react?: string };
      typecheck: { ok: boolean; log: string };
      bundle: { ok: boolean; log: string };
      artifacts: AppFile[];
    };
  } catch {
    return null;
  }
}

export function isolatedBuildUnavailable(reason: string): {
  result: AppJobResult;
  artifacts: AppFile[];
  manifestHash: string | null;
} {
  return {
    result: {
      ok: false,
      isolation: 'unavailable',
      sandbox: false,
      typecheck: { ok: false, log: '' },
      bundle: { ok: false, log: '' },
      blocker: reason,
      stages: [{ kind: 'failed', at: new Date().toISOString(), detail: reason }],
    },
    artifacts: [],
    manifestHash: null,
  };
}

export async function buildIsolatedGeneratedApp(
  files: AppFile[],
  options: {
    exec?: AppsDockerExec;
    env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
    timeoutMs?: number;
    name?: string;
    signal?: AbortSignal;
    onStage?: (kind: 'typecheck' | 'bundle', detail: string) => Promise<void>;
  } = {},
) {
  const env = options.env ?? process.env;
  const image = appsImage(env);
  const timeoutMs = options.timeoutMs ?? 90000;
  const stages: AppJobResult['stages'] = [];
  const record = async (kind: AppJobResult['stages'][number]['kind'], detail: string) => {
    stages.push({ kind, at: new Date().toISOString(), detail });
    if ((kind === 'typecheck' || kind === 'bundle') && options.onStage) await options.onStage(kind, detail);
  };
  const probe = await probeAppsDockerIsolation(env, options.exec);
  if (!probe.available) {
    await record('failed', probe.reason);
    return isolatedBuildUnavailable(probe.reason);
  }
  const work = await mkdtemp(join(tmpdir(), 'architect-apps-iso-'));
  const name = options.name ?? `apps-${Date.now().toString(36)}`;
  try {
    const tree = overlaySealedFiles(files);
    for (const file of tree) {
      const target = join(work, 'src-tree', file.path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, file.content, 'utf8');
    }
    const runnerFile = join(work, 'apps-runner.mjs');
    const jobFile = join(work, 'apps-job.json');
    await writeFile(runnerFile, trustedAppsContainerRunner, 'utf8');
    await writeFile(jobFile, JSON.stringify({ files: tree.map((file) => ({ path: file.path })), timeout_ms: timeoutMs }), 'utf8');
    const invocation = appsDockerInvocation(join(work, 'src-tree'), runnerFile, image, { jobFile, name });
    assertSafeAppsDockerArgs(invocation.args);
    const exec = options.exec ?? ((file, args, execOptions) => execFileAsync(file, args, execOptions));
    const teardown = async () => removeNamedAppsContainer(name, exec, env);
    let stdout = '';
    let stderr = '';
    try {
      if (options.signal?.aborted) {
        const closed = await teardown();
        await record(
          'cancelled',
          closed.confirmed
            ? 'Owner cancelled the isolated build. Named container teardown confirmed.'
            : 'Owner cancelled the isolated build.',
        );
        return {
          result: {
            ok: false,
            isolation: 'docker',
            sandbox: false,
            typecheck: { ok: false, log: '' },
            bundle: { ok: false, log: '' },
            blocker: 'Owner cancelled the isolated build.',
            stages,
          } satisfies AppJobResult,
          artifacts: [],
          manifestHash: null,
        };
      }
      if (options.exec) {
        const ran = await options.exec(invocation.command, invocation.args, {
          timeout: timeoutMs,
          env: { PATH: env.PATH ?? '/usr/local/bin:/usr/bin:/bin' } as unknown as NodeJS.ProcessEnv,
        });
        stdout = ran.stdout;
        stderr = ran.stderr ?? '';
      } else {
        const ran = await new Promise<{ stdout: string; stderr: string; code: number | null }>((resolve, reject) => {
          const child = spawn(invocation.command, invocation.args, {
            env: { PATH: env.PATH ?? '/usr/local/bin:/usr/bin:/bin', NODE_ENV: 'production' } as NodeJS.ProcessEnv,
            stdio: ['ignore', 'pipe', 'pipe'] satisfies ['ignore', 'pipe', 'pipe'],
          });
          let settled = false;
          const finish = (result: { stdout: string; stderr: string; code: number | null }) => {
            if (settled) return;
            settled = true;
            options.signal?.removeEventListener('abort', onAbort);
            resolve(result);
          };
          const onAbort = () => {
            child.kill('SIGKILL');
            void teardown();
          };
          options.signal?.addEventListener('abort', onAbort, { once: true });
          child.stdout.on('data', (chunk: Buffer) => {
            if (stdout.length < 400000) stdout += chunk.toString('utf8');
          });
          child.stderr.on('data', (chunk: Buffer) => {
            if (stderr.length < 20000) stderr += chunk.toString('utf8');
          });
          const timer = setTimeout(() => {
            child.kill('SIGKILL');
            void teardown();
            finish({ stdout, stderr: `${stderr}\nIsolated build timed out.`, code: 1 });
          }, timeoutMs);
          child.on('error', (error: Error) => {
            clearTimeout(timer);
            options.signal?.removeEventListener('abort', onAbort);
            reject(error);
          });
          child.on('close', (code: number | null) => {
            clearTimeout(timer);
            finish({ stdout, stderr, code });
          });
        });
        stdout = ran.stdout;
        stderr = ran.stderr;
        if (options.signal?.aborted) {
          const closed = await teardown();
          await record(
            'cancelled',
            closed.confirmed
              ? 'Owner cancelled the isolated build. Named container teardown confirmed.'
              : 'Owner cancelled the isolated build. Named container teardown was requested.',
          );
          return {
            result: {
              ok: false,
              isolation: 'docker',
              sandbox: false,
              typecheck: { ok: false, log: '' },
              bundle: { ok: false, log: '' },
              blocker: 'Owner cancelled the isolated build.',
              stages,
            } satisfies AppJobResult,
            artifacts: [],
            manifestHash: null,
          };
        }
      }
      void stderr;
      const parsed = parseAppsContainerResult(stdout);
      if (!parsed) {
        await teardown();
        const reason = 'Isolated runner did not emit a fenced result. Generated code never executed in the credentialed host process.';
        await record('failed', reason);
        return isolatedBuildUnavailable(reason);
      }
      if (parsed.versions) {
        const versions = parseAppsToolchainVersions(JSON.stringify(parsed.versions));
        if (!versions.ok) {
          await teardown();
          await record('failed', versions.reason ?? 'Toolchain mismatch.');
          return isolatedBuildUnavailable(versions.reason ?? 'Toolchain mismatch.');
        }
      }
      await record('typecheck', parsed.typecheck.ok ? 'Isolated TypeScript noEmit passed.' : 'Isolated TypeScript noEmit failed.');
      await record('bundle', parsed.bundle.ok ? 'Isolated Vite production bundle passed.' : 'Isolated Vite production bundle failed.');
      const artifacts = parsed.ok ? parsed.artifacts : [];
      if (parsed.ok) assertSingleBundleArtifacts(artifacts);
      const closed = await teardown();
      if (!closed.confirmed && !options.exec)
        await record('failed', 'Named container teardown was not confirmed after the isolated build.');
      return {
        result: {
          ok: parsed.ok,
          isolation: 'docker',
          sandbox: parsed.ok,
          toolchain: APP_TOOLCHAIN_VERSION,
          typecheck: parsed.typecheck,
          bundle: parsed.bundle,
          blocker: parsed.ok
            ? null
            : `Isolated typecheck or bundle failed. The last successful application is retained.\n${parsed.typecheck.log}\n${parsed.bundle.log}`.trim(),
          stages,
        } satisfies AppJobResult,
        artifacts,
        manifestHash: artifacts.length ? artifactManifestHash(artifacts) : null,
      };
    } catch (error) {
      await teardown();
      throw error;
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Isolated build unavailable.';
    await record('failed', reason);
    return isolatedBuildUnavailable(reason);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
