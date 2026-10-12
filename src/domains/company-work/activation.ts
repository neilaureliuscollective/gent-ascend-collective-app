import 'server-only';
import { IntelligenceError } from '@/domains/intelligence/service';
export function workContractReady(env: Partial<NodeJS.ProcessEnv> = process.env) {
  return (
    !['preview', 'production'].includes(env.VERCEL_ENV ?? '') ||
    env.FOUNDER_WORK_CONTRACT_READY === '1'
  );
}
export function requireWorkContractReady() {
  if (!workContractReady())
    throw new IntelligenceError(
      'Task plans, approvals and deliverable generation are awaiting release validation. You can save objectives and review existing work.',
      503,
    );
}
