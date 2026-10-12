import { z } from 'zod';
export const approvalKinds = [
  'spending',
  'external_communication',
  'publishing',
  'deployment',
  'destructive_operation',
  'sensitive_account',
] as const;
export const approvalFields = z
  .object({
    id: z.uuid(),
    kind: z.enum(approvalKinds),
    title: z.string().trim().min(3).max(120),
    proposal: z.string().trim().min(3).max(2000),
    figureIds: z.array(z.uuid()).max(8),
  })
  .strict();
export const workApproval = approvalFields
  .extend({ status: z.enum(['pending', 'approved', 'rejected']) })
  .strict();
export type WorkApproval = z.infer<typeof workApproval>;
export function preserveApprovalDecisions(
  proposed: WorkApproval[] | undefined,
  existing: WorkApproval[] | undefined,
) {
  const prior = new Map((existing ?? []).map((item) => [item.id, item]));
  if ((existing ?? []).some((item) => !proposed?.some((next) => next.id === item.id))) return false;
  return (proposed ?? []).every((item) => {
    const saved = prior.get(item.id);
    const canonical = (value: WorkApproval) =>
      JSON.stringify({
        id: value.id,
        kind: value.kind,
        title: value.title,
        proposal: value.proposal,
        status: value.status,
        figureIds: [...value.figureIds].sort(),
      });
    return saved ? canonical(item) === canonical(saved) : item.status === 'pending';
  });
}
