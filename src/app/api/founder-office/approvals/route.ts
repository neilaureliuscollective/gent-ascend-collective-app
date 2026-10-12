import {
  approvalRevoke,
  revokeApproval,
  approvalCreate,
  approvalDecide,
  createApproval,
  decideApproval,
} from '@/domains/founder-office/approvals';
import { mutationBody, privateJson, apiError } from '@/domains/intelligence/http';
import { IntelligenceError } from '@/domains/intelligence/service';
export async function POST(request: Request) {
  try {
    const body = await mutationBody(request);
    const revoke = approvalRevoke.safeParse(body);
    if (revoke.success) return privateJson(await revokeApproval(revoke.data));
    const create = approvalCreate.safeParse(body);
    if (create.success) return privateJson(await createApproval(create.data));
    const decision = approvalDecide.safeParse(body);
    if (decision.success) return privateJson(await decideApproval(decision.data));
    throw new IntelligenceError('Check the approval request or decision.');
  } catch (error) {
    return apiError(error);
  }
}
