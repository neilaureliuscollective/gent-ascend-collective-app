import 'server-only';
import { z } from 'zod';
import { approvalFields } from '@/domains/company-work/approvals';
import { founderSession } from './service';
import { readWork, saveWork } from '@/domains/company-work/service';
import { workSnapshot } from './tasks';
import { IntelligenceError } from '@/domains/intelligence/service';
const common = {
  companyId: z.uuid(),
  jobId: z.uuid(),
  expected: z.number().int().min(0).max(2147483646),
  versionId: z.uuid(),
};
export const approvalCreate = z.object({ ...common, proposal: approvalFields }).strict();
export const approvalDecide = z
  .object({ ...common, proposalId: z.uuid(), approve: z.boolean() })
  .strict();
export const approvalRevoke = z
  .object({ ...common, proposalId: z.uuid(), action: z.literal('revoke') })
  .strict();
export async function revokeApproval(input: z.infer<typeof approvalRevoke>) {
  await founderSession();
  const work = await readWork(input.companyId, input.jobId);
  const content = workSnapshot(work, input.expected);
  const proposal = content.approvalRequests?.find((item) => item.id === input.proposalId);
  if (!proposal) throw new IntelligenceError('Approval not found in this mission snapshot.', 404);
  if (proposal.status !== 'approved')
    throw new IntelligenceError('Only an approved proposal can be withdrawn.', 409);
  return saveWork(input.companyId, input.jobId, input.versionId, input.expected, {
    ...content,
    approvalRequests: content.approvalRequests!.map((item) =>
      item.id === input.proposalId ? { ...item, status: 'rejected' } : item,
    ),
  });
}
export async function createApproval(input: z.infer<typeof approvalCreate>) {
  await founderSession();
  const work = await readWork(input.companyId, input.jobId);
  const content = workSnapshot(work, input.expected);
  if ((content.approvalRequests ?? []).some((item) => item.id === input.proposal.id))
    throw new IntelligenceError('Proposal already exists in this snapshot.', 409);
  if ((content.approvalRequests ?? []).length >= 12)
    throw new IntelligenceError('This mission supports twelve approval requests.');
  return saveWork(input.companyId, input.jobId, input.versionId, input.expected, {
    ...content,
    approvalRequests: [
      ...(content.approvalRequests ?? []),
      { ...input.proposal, status: 'pending' },
    ],
  });
}
export async function decideApproval(input: z.infer<typeof approvalDecide>) {
  await founderSession();
  const work = await readWork(input.companyId, input.jobId);
  const content = workSnapshot(work, input.expected);
  const proposal = content.approvalRequests?.find((item) => item.id === input.proposalId);
  if (!proposal) throw new IntelligenceError('Approval not found in this mission snapshot.', 404);
  if (proposal.status !== 'pending')
    throw new IntelligenceError('This proposal already has a decision. Reload its history.', 409);
  // No external execution occurs. Approval binds to the exact immutable proposal version.
  return saveWork(input.companyId, input.jobId, input.versionId, input.expected, {
    ...content,
    approvalRequests: content.approvalRequests!.map((item) =>
      item.id === input.proposalId
        ? { ...item, status: input.approve ? 'approved' : 'rejected' }
        : item,
    ),
  });
}
