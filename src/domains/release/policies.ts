import { supportEmail } from './contact';
export const policyVersion = '2026-10-09-e1';
// An operator must approve this exact text/version; environment configuration
// alone is not proof of inbox delivery, operational readiness or legal review.
export function approvedPolicies(env: Record<string, string | undefined>) {
  const operator = env.GENT_LEGAL_OPERATOR?.trim();
  const email = supportEmail(env);
  if (
    env.GENT_POLICY_APPROVED_VERSION !== policyVersion ||
    !email ||
    !operator ||
    operator.length > 160 ||
    /[\r\n<>]/.test(operator)
  )
    return null;
  return { operator, email, version: policyVersion };
}
