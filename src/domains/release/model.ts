import { accountConfig } from '@/domains/onboarding/config';
import { billingConfig } from '@/domains/billing/config';

import { supportEmail } from './contact';
import { approvedPolicies } from './policies';
export { supportEmail } from './contact';
export type ReleaseCheck = {
  name: string;
  status: 'configured' | 'blocked' | 'unknown';
  next: string;
};
export function releaseReadiness(env: Record<string, string | undefined>) {
  const account = accountConfig(env);
  const billing = billingConfig(env);
  const checks: ReleaseCheck[] = [
    {
      name: 'Public account entry',
      status: account ? 'configured' : 'blocked',
      next: 'Verify new and returning accounts, email delivery, CAPTCHA and recovery on the hosted origin.',
    },
    {
      name: 'Google entry',
      status: account?.google ? 'configured' : 'blocked',
      next: 'Complete the hosted Google sign-in round trip and return to the reviewed draft.',
    },
    {
      name: 'Paid enrollment',
      status: billing?.enrollment ? 'configured' : 'blocked',
      next: 'Run billing readiness, then prove checkout, signed webhook delivery, renewal, failure and cancellation with a test account.',
    },
    {
      name: 'Product connection',
      status:
        env.SHOPIFY_STORE_DOMAIN && env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN ? 'configured' : 'blocked',
      next: 'Verify published products, real cart totals, checkout and merchant fulfillment separately.',
    },
    {
      name: 'Member research',
      status: env.OPENAI_API_KEY ? 'configured' : 'blocked',
      next: 'Ask a current factual question in Aethelios, a specialist and the Table; reload saved sources.',
    },
    {
      name: 'Support contact',
      status: supportEmail(env) ? 'configured' : 'blocked',
      next: 'Send and receive a real support request; confirm who handles billing and account-data requests.',
    },
    {
      name: 'Performance reporting',
      status: env.GENT_PERFORMANCE_ENABLED === 'true' ? 'configured' : 'blocked',
      next: 'Inspect anonymous measurements and log retention. Measure phone and installed-app use before claiming field performance.',
    },
    {
      name: 'Identity and record isolation',
      status: 'unknown',
      next: 'Two actual hosted accounts must save, reload and remain isolated across daily work, chats, grooming and training.',
    },
    {
      name: 'Device acceptance',
      status: 'unknown',
      next: 'Test Fold outer/inner, DeX, iPhone, Facebook browser, keyboard, Still mode and installed/offline return.',
    },
    {
      name: 'Account data requests',
      status: 'unknown',
      next: 'Confirm an owner-verified export/deletion support process and applicable retention before public launch. Self-service whole-account export/deletion is not implemented.',
    },
    {
      name: 'Paid preorders',
      status: 'blocked',
      next: 'Keep closed until supported purchase options, charge timing, delivery terms and merchant acceptance are verified.',
    },
    {
      name: 'Published terms and privacy',
      status: approvedPolicies(env) ? 'configured' : 'blocked',
      next: 'Confirm the applicable privacy, software billing and merchant terms before accepting public customers. Support guidance is not a legal policy.',
    },
    {
      name: 'Shared provider allowance',
      status: env.GENT_AI_BUDGET_ENABLED === 'true' ? 'configured' : 'blocked',
      next: 'Verify reviewed database ceilings and person/project allowances, model/tool input and output bounds, concurrent reservations, failure retention and actual provider billing. Configuration alone is not budget acceptance.',
    },
    {
      name: 'Public release',
      status: 'unknown',
      next: 'Attach exact CI, migration, hosted-account, provider and device receipts; approve the exact deployment and rollback target.',
    },
  ];
  const sha = env.VERCEL_GIT_COMMIT_SHA;
  return { source: sha && /^[a-f0-9]{40}$/i.test(sha) ? sha : null, checks };
}
