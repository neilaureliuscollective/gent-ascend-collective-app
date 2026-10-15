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
  if (input.saveState === 'saved') return { stage: 'saved', label: 'Record saved.' };
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
  return { stage: 'idle', label: 'Describe a useful app, then review files before approval.' };
}
