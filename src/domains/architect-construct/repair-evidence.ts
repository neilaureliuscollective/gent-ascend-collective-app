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

export type RepairGeneration = {
  mode: 'mock' | 'openai' | 'unknown';
  notes?: string;
};

export function persistableGeneration(input?: { mode?: string; notes?: string } | null): RepairGeneration {
  const mode = input?.mode === 'mock' || input?.mode === 'openai' ? input.mode : 'unknown';
  const notes = input?.notes ? sanitizeLog(input.notes, [], 2000).trim() : '';
  return notes ? { mode, notes } : { mode };
}

export function generationProvenanceLabel(generation?: { mode?: string; notes?: string } | null) {
  const persisted = persistableGeneration(generation);
  if (persisted.mode === 'unknown')
    return (
      persisted.notes ||
      'Generation provenance unknown. This is not labelled as a live model-generated result.'
    );
  if (persisted.mode === 'mock')
    return persisted.notes || 'Labelled demonstration. Not a paid OpenAI call.';
  return persisted.notes || 'Authorized model proposal. Isolated execution is still required.';
}

export function repairExecutionRequestId(briefId: string) {
  return briefId;
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
