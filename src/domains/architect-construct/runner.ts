import { mkdtemp, readFile, rm, writeFile, mkdir, lstat } from 'node:fs/promises';
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
import { assertSafeDockerArgs, dockerInvocation, probeDockerIsolation } from './docker';

export type ExecutionJob = {
  source: SourceSnapshot;
  scope: BriefScope;
  previewPath?: string;
};

function unifiedDiff(path: string, before: string, after: string) {
  if (before === after) return '';
  const a = before.split('\n');
  const b = after.split('\n');
  return [`--- a/${path}`, `+++ b/${path}`, '@@', ...a.map((line) => `-${line}`), ...b.map((line) => `+${line}`), ''].join(
    '\n',
  );
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

export async function executeConstruct(job: ExecutionJob): Promise<RunResult> {
  if (job.source.kind !== 'fixture') {
    const isolation = await probeDockerIsolation();
    if (!isolation.available) {
      const notRun = job.scope.acceptance_checks.map((check) => ({
        name: check.name,
        command: [check.command, ...check.args].join(' '),
        exit_code: -1,
        status: 'blocked' as const,
        log: isolation.reason,
      }));
      const invocation = dockerInvocation('/var/empty/construct-src', '/var/empty/construct-runner.mjs');
      assertSafeDockerArgs(invocation.args);
      return {
        isolation: 'unavailable',
        sandbox: false,
        blocker: isolation.reason,
        source_hash: job.source.tree_hash,
        result_hash: null,
        changed_files: [],
        diff: '',
        checks: notRun,
        preview: {
          path: null,
          body: '',
          unavailable_reason: isolation.reason,
        },
        artifacts: [{ kind: 'receipt', ref: 'blocked-isolation', hash: sha256Text(isolation.reason) }],
      };
    }
    const invocation = dockerInvocation('/var/empty/construct-src', '/var/empty/construct-runner.mjs', isolation.image);
    assertSafeDockerArgs(invocation.args);
    return {
      isolation: 'docker',
      sandbox: true,
      blocker: 'Docker is available, but this environment has not been authorized to pull or start the execution image.',
      source_hash: job.source.tree_hash,
      result_hash: null,
      changed_files: [],
      diff: '',
      checks: job.scope.acceptance_checks.map((check) => ({
        name: check.name,
        command: [check.command, ...check.args].join(' '),
        exit_code: -1,
        status: 'blocked' as const,
        log: 'Container start is disabled until founder-authorized local image use.',
      })),
      preview: {
        path: null,
        body: '',
        unavailable_reason: 'Isolated preview requires an authorized disposable container start.',
      },
      artifacts: [],
    };
  }
  return executeInProcess(job);
}
