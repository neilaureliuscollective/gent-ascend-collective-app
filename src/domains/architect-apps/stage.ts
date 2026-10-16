export type AppWorkbenchStage =
  | 'idle'
  | 'preparing'
  | 'building'
  | 'checking'
  | 'preview-ready'
  | 'saving'
  | 'saved'
  | 'conflict'
  | 'failed'
  | 'cancelled';

export function appWorkbenchStage(input: {
  job?: {
    status: string;
    cancel_requested?: boolean;
    result?: {
      ok: boolean;
      isolation?: string;
      blocker?: string | null;
      typecheck?: { ok: boolean };
      bundle?: { ok: boolean };
    } | null;
  } | null;
  events?: Array<{ kind: string }>;
  preview?: { srcDoc?: string; revision?: number | null } | null;
  saveState?: 'idle' | 'saving' | 'saved' | 'conflict' | 'failed';
}): { stage: AppWorkbenchStage; label: string } {
  if (input.saveState === 'saving') return { stage: 'saving', label: 'Saving the record through the host collection.' };
  if (input.saveState === 'conflict') return { stage: 'conflict', label: 'This edit conflicts with a later save. Reload the record before trying again.' };
  if (input.saveState === 'failed')
    return { stage: 'failed', label: 'The last edit is still in the form. The host collection did not confirm the save.' };
  if (input.job?.status === 'cancelled' || input.job?.cancel_requested)
    return { stage: 'cancelled', label: 'Build cancelled. The last working application stays available when one exists.' };
  if (input.job?.status === 'failed' || input.job?.result?.ok === false)
    return {
      stage: 'failed',
      label: input.job.result?.blocker || 'Build failed. The last successful preview stays available.',
    };
  if (input.job?.status === 'queued') return { stage: 'preparing', label: 'Preparing an isolated build. Start already happened.' };
  if (input.job?.status === 'running') {
    const kinds = new Set((input.events ?? []).map((event) => event.kind));
    if (kinds.has('bundle')) return { stage: 'building', label: 'Compiling the approved application.' };
    if (kinds.has('typecheck')) return { stage: 'checking', label: 'Typechecking the approved application.' };
    return { stage: 'building', label: 'Isolated build is running.' };
  }
  if (input.preview?.srcDoc) return { stage: 'preview-ready', label: 'Compiled preview is ready.' };
  if (input.saveState === 'saved') return { stage: 'saved', label: 'Record saved.' };
  return { stage: 'idle', label: 'Describe a useful app, then review files before approval.' };
}

export function compactAppStatus(input: {
  stage: AppWorkbenchStage;
  retained?: boolean;
  uncertain?: boolean;
  recovered?: boolean;
  recoveredRevision?: number;
  awaitingApproval?: boolean;
  blocked?: boolean;
}) {
  if (input.stage === 'preparing' || input.stage === 'building' || input.stage === 'checking') return 'Building';
  if (input.stage === 'saving') return 'Saving';
  if (input.stage === 'conflict' || input.uncertain) return 'Uncertain';
  if (input.stage === 'failed' && input.retained) return 'Failed · last good preview kept';
  if (input.stage === 'failed') return 'Failed';
  if (input.stage === 'cancelled' && input.retained) return 'Cancelled · last good preview kept';
  if (input.stage === 'cancelled') return 'Cancelled';
  if (input.awaitingApproval) return input.retained ? 'Awaiting approval · last good preview kept' : 'Awaiting approval';
  if (input.blocked) return input.retained ? 'Blocked · last good preview kept' : 'Blocked';
  if (input.stage === 'preview-ready') return 'Preview ready';
  if (input.stage === 'saved') return 'Saved';
  if (input.recovered)
    return input.recoveredRevision
      ? `Approved revision ${input.recoveredRevision} recovered`
      : 'Approved revision recovered';
  return 'Waiting';
}
