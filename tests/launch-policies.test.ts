import { describe, expect, it } from 'vitest';
import { approvedPolicies, policyVersion } from '@/domains/release/policies';
import { releaseReadiness } from '@/domains/release/model';
describe('reviewed launch policy publication', () => {
  const env = {
    GENT_POLICY_APPROVED_VERSION: policyVersion,
    GENT_LEGAL_OPERATOR: 'Synthetic review operator',
    GENT_SUPPORT_EMAIL: 'help@example.test',
  };
  it('does not publish unreviewed text or invent an operator or inbox', () => {
    expect(approvedPolicies({})).toBeNull();
    for (const patch of [
      { GENT_POLICY_APPROVED_VERSION: 'old' },
      { GENT_LEGAL_OPERATOR: '' },
      { GENT_LEGAL_OPERATOR: '<script>' },
      { GENT_SUPPORT_EMAIL: 'help@example.test?body=private' },
    ])
      expect(approvedPolicies({ ...env, ...patch })).toBeNull();
    expect(approvedPolicies(env)).toMatchObject({
      operator: 'Synthetic review operator',
      version: policyVersion,
    });
  });
  it('separates configuration from verified operational/provider acceptance', () => {
    const report = releaseReadiness({ ...env, GENT_AI_BUDGET_ENABLED: 'true' });
    expect(report.checks.find((c) => c.name === 'Published terms and privacy')?.status).toBe(
      'configured',
    );
    expect(report.checks.find((c) => c.name === 'Shared provider allowance')?.status).toBe(
      'configured',
    );
    expect(report.checks.find((c) => c.name === 'Public release')?.status).toBe('unknown');
    expect(
      releaseReadiness({}).checks.find((c) => c.name === 'Shared provider allowance')?.status,
    ).toBe('blocked');
  });
});
