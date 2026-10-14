import type { z } from 'zod';
import type { acceptanceCheckSchema } from './schema';

export const checkKinds = ['syntax', 'typecheck', 'build', 'functional'] as const;
export type CheckKind = (typeof checkKinds)[number];

export const sandboxCheckCommands = ['node', 'true', 'false'] as const;

export type PlannedCheck = {
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
  name: string;
  status: 'passed' | 'failed' | 'blocked' | 'not-run';
  exit_code: number;
  command: string;
  log: string;
};

export type CheckCoverageReport = CheckCoveragePlan & {
  preexisting_failures: string[];
  introduced_failures: string[];
  revision_note: string;
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
    .map((file) => ({
      name: `syntax:${file.path}`.slice(0, 80),
      kind: 'syntax' as const,
      reason: 'node --check on an existing JavaScript file inside the approved sandbox (node/true/false only).',
      target: file.path,
      command: {
        name: `syntax:${file.path}`.slice(0, 80),
        command: 'node' as const,
        args: ['--check', file.path],
      },
    }));

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

export function classifyCheckDelta(baseline: CheckOutcome[], post: CheckOutcome[]) {
  const preexisting_failures: string[] = [];
  const introduced_failures: string[] = [];
  for (const check of post) {
    if (check.status !== 'failed') continue;
    const prior = baseline.find((item) => item.name === check.name);
    if (prior?.status === 'failed') preexisting_failures.push(check.name);
    else introduced_failures.push(check.name);
  }
  return { preexisting_failures, introduced_failures };
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

export function noApplicableChecksLabel(plan: Pick<CheckCoveragePlan, 'no_applicable' | 'applicable'>) {
  if (plan.no_applicable) return 'No applicable checks available';
  if (plan.applicable.every((item) => item.kind === 'syntax')) return 'Syntax-only coverage';
  return `${plan.applicable.length} applicable check${plan.applicable.length === 1 ? '' : 's'}`;
}

export function persistableCheckPlan(plan: CheckCoveragePlan) {
  return {
    no_applicable: plan.no_applicable,
    applicable: plan.applicable.map(({ name, kind, reason, target }) => ({
      name,
      kind,
      reason,
      ...(target ? { target } : {}),
    })),
    unsupported: plan.unsupported,
    untested: plan.untested,
  };
}
