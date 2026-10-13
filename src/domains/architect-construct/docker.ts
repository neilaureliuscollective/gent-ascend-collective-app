import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const constructImageName = 'ARCHITECT_CONSTRUCT_IMAGE';
export const defaultConstructImage = 'node:24-alpine';

export type IsolationProbe =
  | { available: true; backend: 'docker'; version: string; image: string }
  | { available: false; backend: 'unavailable'; reason: string };

export function dockerInvocation(snapshotDir: string, runnerFile: string, image = defaultConstructImage) {
  if (snapshotDir.includes('docker.sock') || runnerFile.includes('docker.sock'))
    throw new Error('Docker socket paths are not permitted.');
  return {
    command: 'docker',
    args: [
      'run',
      '--rm',
      '--network',
      'none',
      '--read-only',
      '--tmpfs',
      '/work:rw,exec,nosuid,size=64m',
      '--tmpfs',
      '/tmp:rw,noexec,nosuid,size=16m',
      '--tmpfs',
      '/out:rw,noexec,nosuid,size=8m',
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
      '-w',
      '/work',
      image,
      'node',
      '/opt/construct-runner.mjs',
    ],
  };
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

export async function probeDockerIsolation(
  env: NodeJS.ProcessEnv = process.env,
): Promise<IsolationProbe> {
  const image = env[constructImageName] || defaultConstructImage;
  try {
    const { stdout } = await execFileAsync('docker', ['version', '--format', '{{.Server.Version}}'], {
      timeout: 4000,
      env: { PATH: env.PATH ?? '/usr/local/bin:/usr/bin:/bin' } as unknown as NodeJS.ProcessEnv,
    });
    const version = stdout.trim();
    if (!version)
      return {
        available: false,
        backend: 'unavailable',
        reason: 'Docker is present but reported no engine version.',
      };
    return { available: true, backend: 'docker', version, image };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    const reason =
      code === 'ENOENT'
        ? 'Docker is not installed in this runtime. Isolated container execution is blocked.'
        : `Docker isolation is unavailable: ${error instanceof Error ? error.message : 'unknown error'}`;
    return { available: false, backend: 'unavailable', reason };
  }
}
