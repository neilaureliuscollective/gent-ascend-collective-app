import { terminalStatuses, type ConstructBrief, type ConstructRun } from './schema';

export type RepairRefusal =
  | 'not-terminal'
  | 'not-failed'
  | 'coverage-missing'
  | 'comparison-unavailable'
  | 'preexisting-only'
  | 'unsupported-only'
  | 'no-introduced-failure'
  | 'repair-already-exists'
  | 'parent-is-repair'
  | 'stale-revision'
  | 'source-mismatch';

export type RepairEligibility =
  | {
      ok: true;
      parentRunId: string;
      parentApprovalHash: string;
      sourceId: string;
      projectRevision: number;
      targets: string[];
      coverageNote: 'syntax-only' | 'mixed';
    }
  | { ok: false; code: RepairRefusal; message: string };

function coverageNote(brief: ConstructBrief | null): 'syntax-only' | 'mixed' {
  const applicable = brief?.scope.check_plan?.applicable ?? [];
  if (applicable.length && applicable.every((item) => item.kind === 'syntax')) return 'syntax-only';
  return 'mixed';
}

export function findRepairChild(
  parentRunId: string,
  runs: Array<Pick<ConstructRun, 'id' | 'parent_run_id'>>,
) {
  return runs.find((run) => run.parent_run_id === parentRunId) ?? null;
}

export function selectPendingRepair(
  briefs: Array<Pick<ConstructBrief, 'id' | 'status' | 'scope' | 'approval_hash' | 'invalidation_reason'>>,
  runs: Array<Pick<ConstructRun, 'id' | 'brief_id' | 'parent_run_id'>>,
) {
  const unused = briefs.filter(
    (brief) =>
      brief.scope.repair &&
      !runs.some(
        (run) => run.brief_id === brief.id || run.parent_run_id === brief.scope.repair?.parent_run_id,
      ),
  );
  return unused.find((brief) => brief.status === 'approved') ?? unused[0] ?? null;
}

export function findRepairBrief(
  parentRunId: string,
  briefs: Array<Pick<ConstructBrief, 'scope' | 'status' | 'id'>>,
) {
  return briefs.find((brief) => brief.scope.repair?.parent_run_id === parentRunId) ?? null;
}

export function repairEligible(input: {
  parent: ConstructRun;
  brief: ConstructBrief | null;
  sourceTreeHash?: string | null;
  projectRevision?: number | null;
  runs: Array<Pick<ConstructRun, 'id' | 'parent_run_id'>>;
  briefs: Array<Pick<ConstructBrief, 'scope' | 'status' | 'id'>>;
}): RepairEligibility {
  if (input.parent.parent_run_id)
    return {
      ok: false,
      code: 'parent-is-repair',
      message: 'This run is already a repair. Only one repair is allowed per original journey.',
    };
  if (
    input.projectRevision != null &&
    input.parent.project_revision !== input.projectRevision
  )
    return {
      ok: false,
      code: 'stale-revision',
      message: `This failed run is bound to project revision ${input.parent.project_revision}. The project is now revision ${input.projectRevision}. A repair cannot silently follow the newer revision.`,
    };
  if (!(terminalStatuses as readonly string[]).includes(input.parent.status))
    return { ok: false, code: 'not-terminal', message: 'Propose repair is available only after a terminal run.' };
  if (input.parent.status !== 'failed')
    return {
      ok: false,
      code: 'not-failed',
      message: 'Propose repair is only for a failed run with introduced check failures.',
    };
  const coverage = input.parent.result?.coverage;
  if (!coverage)
    return {
      ok: false,
      code: 'coverage-missing',
      message: 'This run has no recorded check comparison, so a repair cannot be proposed.',
    };
  if (coverage.comparison_note)
    return {
      ok: false,
      code: 'comparison-unavailable',
      message: coverage.comparison_note,
    };
  if (!coverage.introduced_failures.length) {
    if (coverage.preexisting_failures.length)
      return {
        ok: false,
        code: 'preexisting-only',
        message: 'Only pre-existing failures were recorded. Repair is limited to introduced failures.',
      };
    if (coverage.no_applicable || coverage.unsupported.length)
      return {
        ok: false,
        code: 'unsupported-only',
        message: 'Coverage is unsupported or not applicable. That is not an introduced failure to repair.',
      };
    return {
      ok: false,
      code: 'no-introduced-failure',
      message: 'No introduced check failure was identified for this run.',
    };
  }
  if (input.sourceTreeHash && input.sourceTreeHash !== input.parent.source_tree_hash)
    return {
      ok: false,
      code: 'source-mismatch',
      message: 'The pinned source no longer matches this run. Repair stays on the original snapshot.',
    };
  if (findRepairChild(input.parent.id, input.runs) || findRepairBrief(input.parent.id, input.briefs))
    return {
      ok: false,
      code: 'repair-already-exists',
      message: 'This original run already has one repair. A second repair is not queued automatically.',
    };
  return {
    ok: true,
    parentRunId: input.parent.id,
    parentApprovalHash: input.parent.approval_hash,
    sourceId: input.parent.source_id,
    projectRevision: input.parent.project_revision,
    targets: coverage.introduced_failures,
    coverageNote: coverageNote(input.brief),
  };
}
