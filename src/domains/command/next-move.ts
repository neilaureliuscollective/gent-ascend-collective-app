/** Shared by Command and Aethelios' explicitly enabled context. No model or write. */
export type MoveContext = {
  day: string;
  actions: { id: string; title: string; done: boolean }[];
  reviewed: boolean;
  previousReview: { day: string; tomorrow: string } | null;
  goalStep: string | null;
};
export function resolveNextMove(context: MoveContext) {
  const next = context.actions.find((action) => !action.done);
  if (next)
    return {
      kind: 'action' as const,
      title: next.title,
      actionId: next.id,
      source: 'First unfinished action in your saved order',
      sourceDay: context.day,
      href: null,
    };
  // A completed plan is a success state, not an invitation to add more work.
  if (context.actions.length || context.reviewed)
    return {
      kind: 'rest' as const,
      title: 'Leave room for what matters.',
      actionId: null,
      source: 'Your saved plan is complete. Nothing else is required here.',
      sourceDay: context.day,
      href: null,
    };
  if (context.previousReview?.tomorrow.trim() && context.previousReview.day < context.day)
    return {
      kind: 'review' as const,
      title: context.previousReview.tomorrow.trim(),
      actionId: null,
      source: `Your confirmed review · ${context.previousReview.day}`,
      sourceDay: context.previousReview.day,
      href: null,
    };
  if (context.goalStep?.trim())
    return {
      kind: 'goal' as const,
      title: context.goalStep.trim(),
      actionId: null,
      source: 'Your saved goal’s next step',
      sourceDay: null,
      href: '/app/goals',
    };
  return {
    kind: 'rest' as const,
    title: 'Leave room for what matters.',
    actionId: null,
    source: 'No next action selected. Nothing to maintain here.',
    sourceDay: null,
    href: null,
  };
}
