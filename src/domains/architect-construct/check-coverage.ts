import type { z } from 'zod';
import type { acceptanceCheckSchema } from './schema';

export const checkKinds = ['syntax', 'typecheck', 'build', 'functional'] as const;
export type CheckKind = (typeof checkKinds)[number];

export const sandboxCheckCommands = ['node', 'true', 'false'] as const;

export const CHECK_NAME_MAX = 80;

export type PlannedCheck = {
  id: string;
  name: string;
  kind: CheckKind;
  reason: string;
  target?: string;
  command?: z.infer<typeof acceptanceCheckSchema>;
};

export type UnsupportedCheck = {
  kind: CheckKind;
  reason: string;
};

export type CheckCoveragePlan = {
  no_applicable: boolean;
  applicable: PlannedCheck[];
  unsupported: UnsupportedCheck[];
  untested: string[];
};

export type CheckOutcome = {
  id?: string;
  name: string;
  status: 'passed' | 'failed' | 'blocked' | 'not-run';
  exit_code: number;
  command: string;
  target?: string;
  log: string;
};

export type CheckCoverageReport = CheckCoveragePlan & {
  preexisting_failures: string[];
  introduced_failures: string[];
  revision_note: string;
  comparison_note?: string;
};

export type ToolchainInspection = {
  has_javascript: boolean;
  has_typescript: boolean;
  has_package_manifest: boolean;
  has_tsconfig: boolean;
  has_test_files: boolean;
  package_scripts: string[];
};

const jsPath = /\.(?:mjs|cjs|js)$/;
const tsPath = /\.(?:ts|tsx)$/;
const testPath = /(?:\.test|\.spec|\/tests\/)/i;

function packageScripts(content: string): string[] {
  try {
    const parsed = JSON.parse(content) as { scripts?: Record<string, string> };
    return parsed.scripts ? Object.keys(parsed.scripts) : [];
  } catch {
    return [];
  }
}

export function checkDisplayName(kind: string, target: string) {
  const full = `${kind}:${target}`;
  return full.length <= CHECK_NAME_MAX ? full : `${full.slice(0, CHECK_NAME_MAX - 1)}…`;
}

export function checkIdentity(input: {
  kind?: string;
  command?: string | { command: string; args: string[] };
  target?: string;
  args?: string[];
}) {
  const command =
    typeof input.command === 'string'
      ? input.command
      : input.command
        ? [input.command.command, ...input.command.args].join(' ')
        : input.args
          ? input.args.join(' ')
          : '';
  const target = input.target ?? '';
  const kind = input.kind ?? 'check';
  return `${kind}:${command}:${target}`;
}

export function identityFromRecordedCheck(check: Pick<CheckOutcome, 'id' | 'command' | 'target'>) {
  if (check.id) return check.id;
  if (check.command && check.target) return checkIdentity({ command: check.command, target: check.target });
  if (check.command) return `command:${check.command}`;
  return null;
}

export function inspectProjectToolchain(files: { path: string; content: string }[]): ToolchainInspection {
  const scripts = files
    .filter((file) => file.path === 'package.json' || file.path.endsWith('/package.json'))
    .flatMap((file) => packageScripts(file.content));
  return {
    has_javascript: files.some((file) => jsPath.test(file.path)),
    has_typescript: files.some((file) => tsPath.test(file.path)),
    has_package_manifest: files.some((file) => file.path.endsWith('package.json')),
    has_tsconfig: files.some((file) => file.path.endsWith('tsconfig.json') || file.path.endsWith('jsconfig.json')),
    has_test_files: files.some((file) => testPath.test(file.path)),
    package_scripts: scripts,
  };
}

export function planCheckCoverage(files: { path: string; content: string }[]): CheckCoveragePlan {
  const toolchain = inspectProjectToolchain(files);
  const applicable: PlannedCheck[] = files
    .filter((file) => jsPath.test(file.path))
    .slice(0, 8)
    .map((file) => {
      const name = checkDisplayName('syntax', file.path);
      const command = {
        name,
        command: 'node' as const,
        args: ['--check', file.path],
      };
      return {
        id: checkIdentity({ kind: 'syntax', command, target: file.path }),
        name,
        kind: 'syntax' as const,
        reason: 'node --check on an existing JavaScript file inside the approved sandbox (node/true/false only).',
        target: file.path,
        command,
      };
    });

  const unsupported: UnsupportedCheck[] = [];
  if (toolchain.has_typescript || toolchain.has_tsconfig)
    unsupported.push({
      kind: 'typecheck',
      reason:
        'Type checking was not run. tsc is not in the approved sandbox command set (node, true, false). This is not a typecheck pass.',
    });
  if (toolchain.package_scripts.some((name) => /build|next/.test(name)) || toolchain.has_package_manifest)
    unsupported.push({
      kind: 'build',
      reason:
        'Build validation was not run. The sandbox cannot install dependencies, open the network, or execute npm/next. A platform CI pass is not evidence that this change works.',
    });
  if (toolchain.has_test_files || toolchain.package_scripts.includes('test'))
    unsupported.push({
      kind: 'functional',
      reason:
        'Functional tests were not run. The approved execution boundary does not install fixtures or execute project test runners.',
    });
  else
    unsupported.push({
      kind: 'functional',
      reason: 'No functional test runner is available in this snapshot. Passing syntax does not prove behavior.',
    });

  return {
    no_applicable: applicable.length === 0,
    applicable,
    unsupported,
    untested: [
      'Runtime application behavior',
      'Static HTML/Markdown preview is not a running application',
      'Hosted or platform CI of this repository',
    ],
  };
}

export function acceptanceChecksFromPlan(plan: CheckCoveragePlan) {
  return plan.applicable.flatMap((item) => (item.command ? [item.command] : []));
}

function identityKeys(check: Pick<CheckOutcome, 'id' | 'command' | 'target' | 'name'>) {
  const keys: string[] = [];
  if (check.id) keys.push(`id:${check.id}`);
  if (check.command && check.target) keys.push(`cmd-target:${check.command}\0${check.target}`);
  if (check.command) keys.push(`cmd:${check.command}`);
  return keys;
}

function indexByKeys(items: CheckOutcome[]) {
  const byKey = new Map<string, CheckOutcome[]>();
  for (const item of items) {
    for (const key of identityKeys(item)) {
      const listed = byKey.get(key) ?? [];
      listed.push(item);
      byKey.set(key, listed);
    }
  }
  return byKey;
}

function uniqueItems(items: CheckOutcome[]) {
  return [...new Set(items)];
}

function comparisonUnavailable(reason: string) {
  return {
    preexisting_failures: [] as string[],
    introduced_failures: [] as string[],
    comparison_note: reason,
  };
}

export function classifyCheckDelta(baseline: CheckOutcome[], post: CheckOutcome[]) {
  const preexisting_failures: string[] = [];
  const introduced_failures: string[] = [];
  const baselineKeys = indexByKeys(baseline);
  const postKeys = indexByKeys(post);
  const byName = new Map<string, CheckOutcome[]>();
  for (const item of baseline) {
    const named = byName.get(item.name) ?? [];
    named.push(item);
    byName.set(item.name, named);
  }
  for (const [key, items] of baselineKeys) {
    if (uniqueItems(items).length > 1 && (key.startsWith('id:') || key.startsWith('cmd-target:'))) {
      return comparisonUnavailable(
        'Check comparison is unavailable because stored results share a duplicate identity. A new failure was not classified as pre-existing.',
      );
    }
  }
  for (const [key, items] of postKeys) {
    if (uniqueItems(items).length > 1 && (key.startsWith('id:') || key.startsWith('cmd-target:'))) {
      return comparisonUnavailable(
        'Check comparison is unavailable because post-change results share a duplicate identity. A new failure was not classified as pre-existing.',
      );
    }
  }
  let comparison_note: string | undefined;
  for (const check of post) {
    if (check.status !== 'failed') continue;
    const keys = identityKeys(check);
    let prior: CheckOutcome | undefined;
    let ambiguous = false;
    for (const key of keys) {
      const matches = uniqueItems(baselineKeys.get(key) ?? []);
      if (matches.length === 1) {
        prior = matches[0];
        ambiguous = false;
        break;
      }
      if (matches.length > 1) {
        ambiguous = true;
        break;
      }
    }
    if (!keys.length) {
      const sameName = byName.get(check.name) ?? [];
      if (sameName.length > 1) {
        comparison_note =
          'Check comparison is unavailable because historical evidence uses a shared display name without a unique identity.';
        continue;
      }
      prior = sameName[0];
    } else if (ambiguous) {
      comparison_note =
        'Check comparison is unavailable because historical evidence uses a shared command without a unique identity.';
      continue;
    }
    const label = identityFromRecordedCheck(check) ?? check.name;
    if (prior?.status === 'failed') preexisting_failures.push(label);
    else introduced_failures.push(label);
  }
  return { preexisting_failures, introduced_failures, ...(comparison_note ? { comparison_note } : {}) };
}

export function reportCheckCoverage(
  plan: CheckCoveragePlan,
  baseline: CheckOutcome[],
  post: CheckOutcome[],
  revisionNote: string,
): CheckCoverageReport {
  return {
    ...plan,
    ...classifyCheckDelta(baseline, post),
    revision_note: revisionNote,
  };
}

export function noApplicableChecksLabel(plan: {
  no_applicable: boolean;
  applicable: Array<{ kind: CheckKind }>;
}) {
  if (plan.no_applicable) return 'No applicable checks available';
  if (plan.applicable.every((item) => item.kind === 'syntax')) return 'Syntax-only coverage';
  return `${plan.applicable.length} applicable check${plan.applicable.length === 1 ? '' : 's'}`;
}

export function persistableCheckPlan(plan: CheckCoveragePlan) {
  return {
    no_applicable: plan.no_applicable,
    applicable: plan.applicable.map(({ id, name, kind, reason, target }) => ({
      id,
      name,
      kind,
      reason,
      ...(target ? { target } : {}),
    })),
    unsupported: plan.unsupported,
    untested: plan.untested,
  };
}

export function recordedCheckResult(
  check: { name: string; command: 'node' | 'true' | 'false'; args: string[] },
  executed: { exit_code: number; log: string },
) {
  const target = check.args.find((arg) => arg !== '--check');
  return {
    id: checkIdentity({
      kind: 'syntax',
      command: { command: check.command, args: check.args },
      target,
    }),
    name: check.name,
    command: [check.command, ...check.args].join(' '),
    target,
    exit_code: executed.exit_code,
    status: executed.exit_code === 0 ? ('passed' as const) : ('failed' as const),
    log: executed.log,
  };
}
