import { access, mkdtemp, readFile, rm, writeFile, mkdir, lstat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import {
  type BriefScope,
  type RunResult,
  type SourceSnapshot,
  checkResultSchema,
  defaultLimits,
  relPath,
} from './schema';
import {
  classifyCheckDelta,
  persistableCheckPlan,
  planCheckCoverage,
  recordedCheckResult,
  type CheckOutcome,
} from './check-coverage';
import { boundRunResult } from './receipt-budget';
import type { z } from 'zod';
import { PathGuardError, assertNoSymlink, assertWritable, resolveInside } from './paths';
import { assertNoHostSecrets, sanitizeLog, strippedEnv } from './sanitize';
import { sha256Text, treeHash } from './hash';
import { matchesCanonicalFixture } from './fixture';
import {
  type IsolationProbe,
  assertSafeDockerArgs,
  dockerInvocation,
  ensureConstructImage,
  parseContainerResult,
  parseWorkspaceDiagnostics,
  probeDockerIsolation,
  trustedContainerRunner,
} from './docker';

export type ExecutionJob = {
  source: SourceSnapshot;
  scope: BriefScope;
  previewPath?: string;
};

export type ContainerLaunchResult = {
  exit_code: number;
  stdout: string;
  stderr: string;
  stopped?: boolean;
  aborted?: boolean;
};
export const TEARDOWN_CONFIRMED = 'teardown-confirmed';
export const TEARDOWN_UNCONFIRMED = 'teardown-unconfirmed';

export function teardownConfirmed(result: RunResult) {
  return result.artifacts.some((item) => item.ref === TEARDOWN_CONFIRMED);
}

function withTeardownReceipt(result: RunResult, confirmed: boolean): RunResult {
  return {
    ...result,
    artifacts: [
      ...result.artifacts.filter(
        (item) => item.ref !== TEARDOWN_CONFIRMED && item.ref !== TEARDOWN_UNCONFIRMED,
      ),
      {
        kind: 'receipt',
        ref: confirmed ? TEARDOWN_CONFIRMED : TEARDOWN_UNCONFIRMED,
        hash: sha256Text(confirmed ? TEARDOWN_CONFIRMED : TEARDOWN_UNCONFIRMED),
      },
    ],
  };
}
export type ContainerLauncher = (
  args: string[],
  timeoutMs: number,
  shouldAbort?: () => boolean,
) => Promise<ContainerLaunchResult>;
export type IsolationProbeFn = () => Promise<IsolationProbe>;

export const TRUSTED_IN_PROCESS = Symbol.for('architect-construct.trusted-in-process');

export type ExecuteOptions = {
  probe?: IsolationProbeFn;
  launchContainer?: ContainerLauncher;
  ensureImage?: typeof import('./docker').ensureConstructImage;
  requireIsolation?: boolean;
  trustedInProcess?: symbol;
  shouldAbort?: () => boolean;
};

function unifiedDiff(path: string, before: string, after: string) {
  if (before === after) return '';
  const a = before.split('\n');
  const b = after.split('\n');
  return [`--- a/${path}`, `+++ b/${path}`, '@@', ...a.map((line) => `-${line}`), ...b.map((line) => `+${line}`), ''].join(
    '\n',
  );
}

export function observedChange(
  sourceFiles: { path: string; content: string }[],
  observedFiles: { path: string; content: string }[],
) {
  const before = new Map(sourceFiles.map((file) => [file.path, file.content]));
  const changed: string[] = [];
  let diff = '';
  for (const file of observedFiles) {
    const previous = before.get(file.path) ?? '';
    if (previous !== file.content) {
      changed.push(file.path);
      diff += unifiedDiff(file.path, previous, file.content);
    }
  }
  return { changed, diff };
}

export async function collectObservedFiles(root: string, allowed: string[], maxFileBytes: number) {
  const files: { path: string; content: string }[] = [];
  for (const path of allowed) {
    try {
      const target = assertNoSymlink(root, path);
      const content = await readFile(target, 'utf8');
      if (Buffer.byteLength(content, 'utf8') > maxFileBytes)
        throw new PathGuardError('Observed file exceeds the approved size limit.');
      files.push({ path, content });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
  }
  return files;
}

function validateObservedPayload(
  files: unknown,
  scope: BriefScope,
): { path: string; content: string }[] | null {
  if (!Array.isArray(files)) return null;
  const observed: { path: string; content: string }[] = [];
  for (const file of files) {
    if (!file || typeof file !== 'object') return null;
    const path = (file as { path?: unknown }).path;
    const content = (file as { content?: unknown }).content;
    if (typeof path !== 'string' || typeof content !== 'string') return null;
    if (!relPath.safeParse(path).success) return null;
    if (!scope.allowed_paths.includes(path)) return null;
    if (Buffer.byteLength(content, 'utf8') > scope.resource_limits.max_file_bytes) return null;
    observed.push({ path, content });
  }
  return observed;
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
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        throw new PathGuardError(
          `Creating ${path} is not supported in this pass. Empty before-text is not a new file.`,
        );
      throw error;
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
    ...recordedCheckResult(check, { exit_code: -1, log: blocker }),
    status: 'blocked' as const,
  }));
  const plan = job.scope.check_plan ?? persistableCheckPlan(planCheckCoverage(job.source.files));
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
    baseline_checks: checks,
    coverage: {
      no_applicable: plan.no_applicable,
      preexisting_failures: [],
      introduced_failures: [],
      untested: plan.untested,
      unsupported: plan.unsupported,
      revision_note: `blocked ${job.source.tree_hash.slice(0, 12)}`,
    },
    preview: { path: null, body: '', unavailable_reason: blocker },
    artifacts: [{ kind: 'receipt', ref: 'blocked-isolation', hash: sha256Text(blocker) }],
  };
}

function enrichRecordedCheck(
  check: z.infer<typeof checkResultSchema>,
  planned?: { name: string; command: 'node' | 'true' | 'false'; args: string[] },
) {
  if (!planned) return check;
  const recorded = recordedCheckResult(planned, { exit_code: check.exit_code, log: check.log });
  return {
    ...check,
    id: check.id ?? recorded.id,
    target: check.target ?? recorded.target,
    status: check.status,
  };
}

function parseCheckResults(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const parsed = checkResultSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

function coverageFromResults(
  job: ExecutionJob,
  baseline: CheckOutcome[],
  post: CheckOutcome[],
): NonNullable<RunResult['coverage']> {
  const plan = job.scope.check_plan ?? persistableCheckPlan(planCheckCoverage(job.source.files));
  const delta = classifyCheckDelta(baseline, post);
  return {
    no_applicable: plan.no_applicable,
    preexisting_failures: delta.preexisting_failures,
    introduced_failures: delta.introduced_failures,
    untested: plan.untested,
    unsupported: plan.unsupported,
    revision_note: `${job.source.kind} ${job.source.tree_hash.slice(0, 12)}`,
    ...(delta.comparison_note ? { comparison_note: delta.comparison_note } : {}),
  };
}

export async function executeInProcess(job: ExecutionJob): Promise<RunResult> {
  const work = await mkdtemp(join(tmpdir(), 'architect-construct-'));
  const checks: z.infer<typeof checkResultSchema>[] = [];
  try {
    await materializeSource(work, job.source, job.scope);
    const baseline: z.infer<typeof checkResultSchema>[] = [];
    for (const check of job.scope.acceptance_checks) {
      const executed = await runCommand(
        check.command,
        check.args,
        work,
        Math.min(8000, job.scope.resource_limits.timeout_ms),
      );
      baseline.push(
        recordedCheckResult(check, {
          exit_code: executed.exit_code,
          log: executed.log.slice(0, job.scope.resource_limits.max_output_bytes),
        }),
      );
    }
    await applyTrustedPatch(work, job.scope);
    for (const check of job.scope.acceptance_checks) {
      const executed = await runCommand(
        check.command,
        check.args,
        work,
        Math.min(8000, job.scope.resource_limits.timeout_ms),
      );
      checks.push(
        recordedCheckResult(check, {
          exit_code: executed.exit_code,
          log: executed.log.slice(0, job.scope.resource_limits.max_output_bytes),
        }),
      );
    }
    const observed = await collectObservedFiles(
      work,
      job.scope.allowed_paths,
      job.scope.resource_limits.max_file_bytes,
    );
    const observedResult = observedChange(job.source.files, observed);
    const previewPath = job.previewPath ?? job.scope.allowed_paths.find((path) => path.endsWith('.html'));
    const previewFile = observed.find((file) => file.path === previewPath);
    const preview = previewFile
      ? {
          path: previewFile.path,
          body: sanitizeLog(previewFile.content, [], job.scope.resource_limits.max_output_bytes),
          unavailable_reason: null,
        }
      : await collectPreview(work, previewPath, job.scope.resource_limits.max_output_bytes);
    return boundRunResult({
      isolation: 'process-fixture',
      runtime_available: false,
      sandbox: false,
      blocker: null,
      source_hash: job.source.tree_hash,
      result_hash: treeHash(observed),
      changed_files: observedResult.changed,
      diff: observedResult.diff,
      checks,
      baseline_checks: baseline,
      coverage: coverageFromResults(job, baseline, checks),
      preview,
      artifacts: [
        { kind: 'diff', ref: 'result.diff', hash: sha256Text(observedResult.diff) },
        { kind: 'preview', ref: preview.path ?? 'preview', hash: sha256Text(preview.body) },
      ],
    });
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

export function containerNameFromArgs(args: string[]) {
  const index = args.indexOf('--name');
  return index >= 0 ? args[index + 1] : undefined;
}

const dockerEnv = () =>
  ({ PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin' }) as unknown as NodeJS.ProcessEnv;

export const DOCKER_COMMAND_DEADLINE_MS = 4000;

export type DockerCommandResult = {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  spawnError: string | null;
};

export type DockerCommandFn = (
  args: string[],
  deadlineMs?: number,
) => Promise<DockerCommandResult>;

export type ContainerPresence =
  | { status: 'absent'; evidence: string }
  | { status: 'present'; running: boolean; evidence: string }
  | { status: 'unknown'; reason: string };

function sanitizeDockerText(value: string) {
  return sanitizeLog(value).replace(/\s+/g, ' ').trim().slice(0, 240);
}

function dockerOutput(result: DockerCommandResult) {
  return `${result.stdout}\n${result.stderr}\n${result.spawnError ?? ''}`;
}

export function isConfirmedNoSuchContainer(text: string) {
  return /no such (?:object|container)/i.test(text) && !isDockerControlPlaneFailure(text);
}

export function isDockerControlPlaneFailure(text: string) {
  return /cannot connect|permission denied|eacces|enoent|no such file|daemon is not running|connection refused|got permission denied while trying to connect|operation not permitted/i.test(
    text,
  );
}

export function classifyDockerInspect(result: DockerCommandResult): ContainerPresence {
  if (result.spawnError)
    return { status: 'unknown', reason: sanitizeDockerText(result.spawnError) };
  if (result.timedOut)
    return { status: 'unknown', reason: 'Docker inspect exceeded the teardown deadline.' };
  const output = dockerOutput(result);
  if (isConfirmedNoSuchContainer(output))
    return { status: 'absent', evidence: 'inspect:no-such-container' };
  if (isDockerControlPlaneFailure(output))
    return {
      status: 'unknown',
      reason: sanitizeDockerText(output || 'Docker inspect could not reach the daemon.'),
    };
  if (result.code === 0) {
    const running = /^\s*true\s*$/i.test(result.stdout) || /"Running"\s*:\s*true/.test(result.stdout);
    return { status: 'present', running, evidence: 'inspect:object' };
  }
  return {
    status: 'unknown',
    reason: sanitizeDockerText(output || `Docker inspect exited ${result.code ?? 'null'}.`),
  };
}

export async function runBoundedProcess(
  command: string,
  args: string[],
  deadlineMs = DOCKER_COMMAND_DEADLINE_MS,
): Promise<DockerCommandResult> {
  return await new Promise((resolve) => {
    let settled = false;
    const child = spawn(command, args, {
      env: dockerEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const finish = (result: DockerCommandResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish({ code: null, stdout, stderr, timedOut: true, spawnError: null });
    }, deadlineMs);
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (error) => {
      finish({
        code: null,
        stdout,
        stderr,
        timedOut: false,
        spawnError: error.message,
      });
    });
    child.on('close', (code) => {
      finish({ code: code ?? 1, stdout, stderr, timedOut: false, spawnError: null });
    });
  });
}

export async function runDockerCommand(
  args: string[],
  deadlineMs = DOCKER_COMMAND_DEADLINE_MS,
) {
  return runBoundedProcess('docker', args, deadlineMs);
}

export async function inspectNamedContainer(
  name: string,
  command: DockerCommandFn = runDockerCommand,
  deadlineMs = DOCKER_COMMAND_DEADLINE_MS,
): Promise<ContainerPresence> {
  if (!name) return { status: 'unknown', reason: 'Container name was missing.' };
  return classifyDockerInspect(await command(['inspect', '-f', '{{.State.Running}}', name], deadlineMs));
}

export async function removeNamedContainer(
  name: string | undefined,
  command: DockerCommandFn = runDockerCommand,
  deadlineMs = DOCKER_COMMAND_DEADLINE_MS,
): Promise<boolean> {
  if (!name) return true;
  await command(['rm', '-f', name], deadlineMs);
  const presence = await inspectNamedContainer(name, command, deadlineMs);
  return presence.status === 'absent';
}

export function spawnDocker(
  args: string[],
  timeoutMs: number,
  shouldAbort?: () => boolean,
  command: DockerCommandFn = runDockerCommand,
): Promise<ContainerLaunchResult> {
  return new Promise((resolve) => {
    const child = spawn('docker', args, {
      env: dockerEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    let stopping = false;
    const name = containerNameFromArgs(args);
    const finish = (result: ContainerLaunchResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearInterval(poll);
      resolve(result);
    };
    const confirmAbsence = async (): Promise<boolean> =>
      name ? removeNamedContainer(name, command) : true;
    const requestStop = (reason: string, code: number) => {
      if (settled || stopping) return;
      stopping = true;
      void confirmAbsence().then((stopped) => {
        child.kill('SIGKILL');
        finish({
          exit_code: code,
          stdout,
          stderr: stderr + `\n${reason}`,
          stopped,
          aborted: true,
        });
      });
    };
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    const timer = setTimeout(() => {
      requestStop('Container timed out.', 124);
    }, timeoutMs);
    const poll = setInterval(() => {
      if (shouldAbort?.()) requestStop('Isolated job cancelled.', 137);
    }, 100);
    if (shouldAbort?.()) requestStop('Isolated job cancelled.', 137);
    child.on('error', (error) => {
      if (stopping) return;
      void (name ? inspectNamedContainer(name, command) : Promise.resolve({ status: 'absent' as const })).then(
        (presence) => {
          finish({
            exit_code: 127,
            stdout,
            stderr: error.message,
            stopped: presence.status === 'absent',
            aborted: false,
          });
        },
      );
    });
    child.on('close', (code) => {
      if (stopping) return;
      void confirmAbsence().then((stopped) => {
        finish({
          exit_code: code ?? 1,
          stdout,
          stderr,
          stopped,
          aborted: false,
        });
      });
    });
  });
}

export async function executeInContainer(
  job: ExecutionJob,
  probe: Extract<IsolationProbe, { available: true }>,
  launch: ContainerLauncher = spawnDocker,
  ensureImage: typeof ensureConstructImage = ensureConstructImage,
  shouldAbort?: () => boolean,
): Promise<RunResult> {
  const root = await mkdtemp(join(tmpdir(), 'architect-construct-docker-'));
  const snapshot = join(root, 'src');
  const runnerFile = join(root, 'construct-runner.mjs');
  const jobFile = join(root, 'construct-job.json');
  const name = `construct-${randomUUID().replace(/-/g, '').slice(0, 20)}`;
  let result: RunResult | undefined;
  let launched: ContainerLaunchResult | undefined;
  const aborted = () => Boolean(shouldAbort?.());
  try {
    if (aborted()) {
      result = blockedResult(job, 'Isolated execution was cancelled before the disposable job finished.', {
        runtime_available: true,
        sandbox: false,
      });
      return result;
    }
    const image = await ensureImage(probe.image);
    if (aborted()) {
      result = blockedResult(job, 'Isolated execution was cancelled before the disposable job finished.', {
        runtime_available: true,
        sandbox: false,
      });
      return result;
    }
    if (!image.ready) {
      result = blockedResult(job, image.reason ?? 'Construct image is unavailable.', {
        runtime_available: true,
        sandbox: false,
      });
      return result;
    }
    await mkdir(snapshot, { recursive: true });
    await materializeSource(snapshot, job.source, job.scope);
    for (const file of job.scope.patch) assertWritable(file.path, job.scope);
    await writeFile(runnerFile, trustedContainerRunner);
    await writeFile(
      jobFile,
      JSON.stringify({
        files: job.source.files.map((file) => ({ path: file.path })),
        patch: job.scope.patch,
        checks: job.scope.acceptance_checks,
        allowed_paths: job.scope.allowed_paths,
        previewPath: job.previewPath ?? job.scope.allowed_paths.find((path) => path.endsWith('.html')) ?? null,
        timeout_ms: Math.min(8000, job.scope.resource_limits.timeout_ms),
      }),
    );
    const invocation = dockerInvocation(snapshot, runnerFile, probe.image, { jobFile, name });
    assertSafeDockerArgs(invocation.args);
    launched = await launch(invocation.args, job.scope.resource_limits.timeout_ms, aborted);
    if (aborted()) {
      result = blockedResult(job, 'Isolated execution was cancelled before the disposable job finished.', {
        runtime_available: true,
        sandbox: false,
      });
      return result;
    }
    const parsed = parseContainerResult(launched.stdout);
    const workspace = parseWorkspaceDiagnostics(launched.stderr);
    if (launched.exit_code !== 0 || !parsed) {
      result = blockedResult(
        job,
        sanitizeLog(
          `${launched.stderr || 'no container stderr'} Disposable container did not return a verified result (exit ${launched.exit_code}). A reachable Docker engine is not a sandbox.`,
        ),
        { runtime_available: true, sandbox: false },
      );
      return result;
    }
    const observed = validateObservedPayload(parsed.files, job.scope);
    if (!observed) {
      result = blockedResult(
        job,
        'Isolated execution did not return observed output bytes. Requested edits are not treated as the result.',
        { runtime_available: true, sandbox: false },
      );
      return result;
    }
    const observedResult = observedChange(job.source.files, observed);
    if (observedResult.diff.length > job.scope.resource_limits.max_diff_bytes) {
      result = blockedResult(job, 'Collected diff exceeds the approved bound.', {
        runtime_available: true,
        sandbox: false,
      });
      return result;
    }
    const previewPath =
      job.previewPath ?? job.scope.allowed_paths.find((path) => path.endsWith('.html')) ?? null;
    const previewFile = observed.find((file) => file.path === previewPath);
    const preview = {
      path: previewPath,
      body: sanitizeLog(
        previewFile?.content ?? '',
        [],
        job.scope.resource_limits.max_output_bytes,
      ),
      unavailable_reason: previewFile ? null : 'Observed preview file was not present in isolated output.',
    };
    const checks = parseCheckResults(parsed.checks).map((check, index) =>
      enrichRecordedCheck(check, job.scope.acceptance_checks[index]),
    );
    const baseline = parseCheckResults(parsed.baseline_checks).map((check, index) =>
      enrichRecordedCheck(check, job.scope.acceptance_checks[index]),
    );
    result = boundRunResult({
      isolation: 'docker',
      runtime_available: true,
      sandbox: true,
      blocker: null,
      source_hash: job.source.tree_hash,
      result_hash: treeHash(observed),
      changed_files: observedResult.changed,
      diff: observedResult.diff,
      checks,
      baseline_checks: baseline,
      coverage: coverageFromResults(job, baseline, checks),
      preview,
      artifacts: [
        { kind: 'diff', ref: 'result.diff', hash: sha256Text(observedResult.diff) },
        { kind: 'preview', ref: preview.path ?? 'preview', hash: sha256Text(preview.body) },
        { kind: 'log', ref: 'container.stdout', hash: sha256Text(launched.stdout) },
        {
          kind: 'receipt',
          ref: 'observed-output',
          hash: treeHash(observed),
        },
        {
          kind: 'receipt',
          ref: 'workspace-permissions',
          hash: sha256Text(JSON.stringify(workspace ?? { missing: true })),
        },
      ],
    });
    return result;
  } finally {
    try {
      await rm(root, { recursive: true, force: true });
    } catch {
      /* Host cleanup must not discard a verified isolated result. */
    }
    const removed = await access(root).then(() => false).catch(() => true);
    if (result) {
      const confirmed = !launched || launched.stopped !== false;
      result.artifacts = withTeardownReceipt(
        {
          ...result,
          artifacts: [
            ...result.artifacts,
            {
              kind: 'receipt',
              ref: removed ? `cleanup-removed:${name}` : `cleanup-failed:${name}`,
              hash: sha256Text(`${root}:${removed ? 'removed' : 'present'}`),
            },
            {
              kind: 'receipt',
              ref: confirmed ? `container-stopped:${name}` : `container-stop-unconfirmed:${name}`,
              hash: sha256Text(`${name}:${confirmed ? 'stopped' : 'unconfirmed'}`),
            },
          ],
        },
        confirmed,
      ).artifacts;
    }
  }
}

export async function executeConstruct(job: ExecutionJob, options: ExecuteOptions = {}): Promise<RunResult> {
  if (!job.source.files.length)
    return withTeardownReceipt(
      blockedResult(
        job,
        'Source snapshot has no files. Missing source is a blocker; Architect will not invent repository contents.',
      ),
      true,
    );
  if (
    !options.requireIsolation &&
    options.trustedInProcess === TRUSTED_IN_PROCESS &&
    matchesCanonicalFixture(job.source)
  )
    return withTeardownReceipt(await executeInProcess(job), true);
  const probe = await (options.probe ?? (() => probeDockerIsolation()))();
  if (!probe.available)
    return withTeardownReceipt(
      blockedResult(job, probe.reason, { runtime_available: false, sandbox: false }),
      true,
    );
  return executeInContainer(
    job,
    probe,
    options.launchContainer,
    options.ensureImage,
    options.shouldAbort,
  );
}
