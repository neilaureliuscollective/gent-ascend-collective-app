import { sanitizeLog } from './sanitize';
import type { PatchFile } from './patch-contract';

export type RepairFailureEvidence = {
  targets: string[];
  blocker: string | null;
  checks: Array<{
    name: string;
    command: string;
    status: string;
    exit_code: number;
    log: string;
  }>;
};

const TARGET_MAX = 8;
const CHECK_MAX = 8;
const LOG_MAX = 2000;

export function sanitizeRepairPatch(patch: PatchFile[]): PatchFile[] {
  return patch.map((file) => ({
    path: file.path,
    before: sanitizeLog(file.before, [], 65536),
    after: sanitizeLog(file.after, [], 65536),
  }));
}

export function sanitizeRepairEvidence(input?: {
  targets?: string[];
  blocker?: string | null;
  checks?: Array<{
    name?: string;
    command?: string;
    status?: string;
    exit_code?: number;
    log?: string;
    target?: string;
  }>;
}): RepairFailureEvidence {
  const targets = (input?.targets ?? [])
    .map((target) => sanitizeLog(target, [], 400).trim())
    .filter(Boolean)
    .slice(0, TARGET_MAX);
  const checks = (input?.checks ?? [])
    .filter((check) => {
      if (check.status === 'failed') return true;
      const name = check.name ?? '';
      const command = check.command ?? '';
      return targets.some(
        (target) => (name && target.includes(name)) || (command && target.includes(command)),
      );
    })
    .slice(0, CHECK_MAX)
    .map((check) => ({
      name: sanitizeLog(check.name ?? 'check', [], 80),
      command: sanitizeLog(check.command ?? '', [], 200),
      status: check.status === 'failed' ? 'failed' : sanitizeLog(check.status ?? 'failed', [], 32),
      exit_code: typeof check.exit_code === 'number' ? check.exit_code : 1,
      log: sanitizeLog(check.log ?? '', [], LOG_MAX),
    }));
  return {
    targets,
    blocker: input?.blocker ? sanitizeLog(input.blocker, [], 400) : null,
    checks,
  };
}
