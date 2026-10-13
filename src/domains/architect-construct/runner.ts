import { chmod, mkdtemp, readFile, rm, writeFile, mkdir, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import {
  type BriefScope,
  type RunResult,
  type SourceSnapshot,
  type checkResultSchema,
  defaultLimits,
} from './schema';
import type { z } from 'zod';
import { PathGuardError, assertNoSymlink, assertWritable, resolveInside } from './paths';
import { assertNoHostSecrets, sanitizeLog, strippedEnv } from './sanitize';
import { sha256Text, treeHash } from './hash';
import {
  type IsolationProbe,
  assertSafeDockerArgs,
  dockerInvocation,
  ensureConstructImage,
  parseContainerResult,
  probeDockerIsolation,
  trustedContainerRunner,
} from './docker';

export type ExecutionJob = {
  source: SourceSnapshot;
  scope: BriefScope;
  previewPath?: string;
};

export type ContainerLaunchResult = { exit_code: number; stdout: string; stderr: string };
export type ContainerLauncher = (
  args: string[],
  timeoutMs: number,
) => Promise<ContainerLaunchResult>;
export type IsolationProbeFn = () => Promise<IsolationProbe>;

export type ExecuteOptions = {
  probe?: IsolationProbeFn;
  launchContainer?: ContainerLauncher;
  ensureImage?: typeof import('./docker').ensureConstructImage;
  requireIsolation?: boolean;
};

function unifiedDiff(path: string, before: string, after: string) {
  if (before === after) return '';
  const a = before.split('\n');
  const b = after.split('\n');
  return [`--- a/${path}`, `+++ b/${path}`, '@@', ...a.map((line) => `-${line}`), ...b.map((line) => `+${line}`), ''].join(
    '\n',
  );
}

function trustedDiff(scope: BriefScope) {
  return scope.patch.map((file) => unifiedDiff(file.path, file.before, file.after)).join('');
}

async function runCommand(command: string, args: string[], cwd: string, timeoutMs: number) {
  const env = strippedEnv(cwd);
  assertNoHostSecrets(env);
  return await new Promise<{ exit_code: number; log: string }>((resolve) => {
    const executable = command === 'node' ? process.execPath : command;
    const child = spawn(executable, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    const append = (chunk: Buffer) => {
      log = sanitizeLog(log + chunk.toString('utf8'));
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({ exit_code: 124, log: sanitizeLog(log + '\nCheck timed out.') });
    }, timeoutMs);
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ exit_code: 127, log: sanitizeLog(error.message) });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ exit_code: code ?? 1, log });
    });
  });
}

export async function applyTrustedPatch(root: string, scope: BriefScope) {
  const changed: string[] = [];
  let diff = '';
  for (const file of scope.patch) {
    const path = assertWritable(file.path, scope);
    const target = assertNoSymlink(root, path);
    await mkdir(dirname(target), { recursive: true });
    let current = '';
    try {
      current = await readFile(target, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    if (current !== file.before)
      throw new PathGuardError(`Patch basis mismatch for ${path}. The approved before-text is absent.`);
    if (Buffer.byteLength(file.after, 'utf8') > (scope.resource_limits?.max_file_bytes ?? defaultLimits.max_file_bytes))
      throw new PathGuardError('Patched file exceeds the approved size limit.');
    await writeFile(target, file.after, { encoding: 'utf8', flag: 'w' });
    const afterStat = await lstat(target);
    if (afterStat.isSymbolicLink()) throw new PathGuardError('Patch produced a symbolic link.');
    changed.push(path);
    diff += unifiedDiff(path, file.before, file.after);
  }
  if (diff.length > scope.resource_limits.max_diff_bytes)
    throw new PathGuardError('Collected diff exceeds the approved bound.');
  return { changed, diff };
}

export async function materializeSource(root: string, source: SourceSnapshot, scope: BriefScope) {
  if (!source.files.length)
    throw new PathGuardError(
      'Source snapshot has no files. Missing source is a blocker; Architect will not invent repository contents.',
    );
  if (source.tree_hash !== treeHash(source.files) || source.tree_hash !== scope.source_tree_hash)
    throw new PathGuardError('Source tree no longer matches the approved brief.');
  if (source.files.length > scope.resource_limits.max_files)
    throw new PathGuardError('Source exceeds the approved file count.');
  for (const file of source.files) {
    if (Buffer.byteLength(file.content, 'utf8') > scope.resource_limits.max_file_bytes)
      throw new PathGuardError('Source file exceeds the approved size limit.');
    const target = resolveInside(root, file.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content, { encoding: 'utf8', flag: 'wx' });
    if ((await lstat(target)).isSymbolicLink()) throw new PathGuardError('Source contained a symbolic link.');
  }
}

async function collectPreview(root: string, path: string | undefined, limit: number) {
  if (!path)
    return { path: null, body: '', unavailable_reason: 'No preview path was included in this brief.' };
  try {
    const target = assertNoSymlink(root, path);
    const body = sanitizeLog(await readFile(target, 'utf8'), [], limit);
    return { path, body, unavailable_reason: null };
  } catch (error) {
    return {
      path,
      body: '',
      unavailable_reason:
        error instanceof Error ? error.message : 'Preview output is unavailable.',
    };
  }
}

export function blockedResult(
  job: ExecutionJob,
  blocker: string,
  extras: Partial<Pick<RunResult, 'isolation' | 'runtime_available' | 'sandbox'>> = {},
): RunResult {
  const checks = job.scope.acceptance_checks.map((check) => ({
    name: check.name,
    command: [check.command, ...check.args].join(' '),
    exit_code: -1,
    status: 'blocked' as const,
    log: blocker,
  }));
  return {
    isolation: extras.isolation ?? 'unavailable',
    runtime_available: extras.runtime_available ?? false,
    sandbox: extras.sandbox ?? false,
    blocker,
    source_hash: job.source.tree_hash,
    result_hash: null,
    changed_files: [],
    diff: '',
    checks,
    preview: { path: null, body: '', unavailable_reason: blocker },
    artifacts: [{ kind: 'receipt', ref: 'blocked-isolation', hash: sha256Text(blocker) }],
  };
}

export async function executeInProcess(job: ExecutionJob): Promise<RunResult> {
  const work = await mkdtemp(join(tmpdir(), 'architect-construct-'));
  const checks: z.infer<typeof checkResultSchema>[] = [];
  try {
    await materializeSource(work, job.source, job.scope);
    const { changed, diff } = await applyTrustedPatch(work, job.scope);
    for (const check of job.scope.acceptance_checks) {
      const executed = await runCommand(
        check.command,
        check.args,
        work,
        Math.min(8000, job.scope.resource_limits.timeout_ms),
      );
      checks.push({
        name: check.name,
        command: [check.command, ...check.args].join(' '),
        exit_code: executed.exit_code,
        status: executed.exit_code === 0 ? 'passed' : 'failed',
        log: executed.log.slice(0, job.scope.resource_limits.max_output_bytes),
      });
    }
    const preview = await collectPreview(
      work,
      job.previewPath ?? job.scope.allowed_paths.find((path) => path.endsWith('.html')),
      job.scope.resource_limits.max_output_bytes,
    );
    const resultFiles = await Promise.all(
      changed.map(async (path) => ({
        path,
        content: await readFile(resolveInside(work, path), 'utf8'),
      })),
    );
    return {
      isolation: 'process-fixture',
      runtime_available: false,
      sandbox: false,
      blocker: null,
      source_hash: job.source.tree_hash,
      result_hash: treeHash(resultFiles),
      changed_files: changed,
      diff,
      checks,
      preview,
      artifacts: [
        { kind: 'diff', ref: 'result.diff', hash: sha256Text(diff) },
        { kind: 'preview', ref: preview.path ?? 'preview', hash: sha256Text(preview.body) },
      ],
    };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

function spawnDocker(args: string[], timeoutMs: number): Promise<ContainerLaunchResult> {
  return new Promise((resolve) => {
    const child = spawn('docker', args, {
      env: { PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin' } as unknown as NodeJS.ProcessEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({ exit_code: 124, stdout, stderr: stderr + '\nContainer timed out.' });
    }, timeoutMs);
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ exit_code: 127, stdout, stderr: error.message });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ exit_code: code ?? 1, stdout, stderr });
    });
  });
}

export async function executeInContainer(
  job: ExecutionJob,
  probe: Extract<IsolationProbe, { available: true }>,
  launch: ContainerLauncher = spawnDocker,
  ensureImage: typeof ensureConstructImage = ensureConstructImage,
): Promise<RunResult> {
  const root = await mkdtemp(join(tmpdir(), 'architect-construct-docker-'));
  const snapshot = join(root, 'src');
  const outDir = join(root, 'out');
  const runnerFile = join(root, 'construct-runner.mjs');
  const jobFile = join(root, 'construct-job.json');
  try {
    const image = await ensureImage(probe.image);
    if (!image.ready)
      return blockedResult(job, image.reason ?? 'Construct image is unavailable.', {
        runtime_available: true,
        sandbox: false,
      });
    await mkdir(snapshot, { recursive: true });
    await mkdir(outDir, { recursive: true });
    await chmod(outDir, 0o777);
    await materializeSource(snapshot, job.source, job.scope);
    for (const file of job.scope.patch) assertWritable(file.path, job.scope);
    await writeFile(runnerFile, trustedContainerRunner);
    await writeFile(
      jobFile,
      JSON.stringify({
        files: job.source.files.map((file) => ({ path: file.path })),
        patch: job.scope.patch,
        checks: job.scope.acceptance_checks,
        previewPath: job.previewPath ?? job.scope.allowed_paths.find((path) => path.endsWith('.html')) ?? null,
        timeout_ms: Math.min(8000, job.scope.resource_limits.timeout_ms),
      }),
    );
    const invocation = dockerInvocation(snapshot, runnerFile, probe.image, { jobFile, outDir });
    assertSafeDockerArgs(invocation.args);
    const launched = await launch(invocation.args, job.scope.resource_limits.timeout_ms);
    const parsed = parseContainerResult(launched.stdout);
    if (launched.exit_code !== 0 || !parsed)
      return blockedResult(
        job,
        sanitizeLog(
          `${launched.stderr || 'no container stderr'} Disposable container did not return a verified result (exit ${launched.exit_code}). A reachable Docker engine is not a sandbox.`,
        ),
        { runtime_available: true, sandbox: false },
      );
    const diff = trustedDiff(job.scope);
    const preview = {
      path: parsed.preview?.path ?? null,
      body: sanitizeLog(String(parsed.preview?.body ?? ''), [], job.scope.resource_limits.max_output_bytes),
      unavailable_reason: parsed.preview?.unavailable_reason ?? null,
    };
    const checks = Array.isArray(parsed.checks) ? parsed.checks : [];
    return {
      isolation: 'docker',
      runtime_available: true,
      sandbox: true,
      blocker: null,
      source_hash: job.source.tree_hash,
      result_hash: sha256Text(JSON.stringify({ files: parsed.changed_files, preview: preview.body })),
      changed_files: job.scope.patch.map((file) => file.path),
      diff,
      checks,
      preview,
      artifacts: [
        { kind: 'diff', ref: 'result.diff', hash: sha256Text(diff) },
        { kind: 'preview', ref: preview.path ?? 'preview', hash: sha256Text(preview.body) },
        { kind: 'log', ref: 'container.stdout', hash: sha256Text(launched.stdout) },
      ],
    };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

export async function executeConstruct(job: ExecutionJob, options: ExecuteOptions = {}): Promise<RunResult> {
  if (!job.source.files.length)
    return blockedResult(
      job,
      'Source snapshot has no files. Missing source is a blocker; Architect will not invent repository contents.',
    );
  if (job.source.kind === 'fixture' && !options.requireIsolation) return executeInProcess(job);
  const probe = await (options.probe ?? (() => probeDockerIsolation()))();
  if (!probe.available)
    return blockedResult(job, probe.reason, { runtime_available: false, sandbox: false });
  return executeInContainer(job, probe, options.launchContainer, options.ensureImage);
}
