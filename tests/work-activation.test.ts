import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { workContractReady } from '../src/domains/company-work/activation';
describe('compatible work-contract release boundary', () => {
  it('keeps hosted previews and production closed unless explicitly configured', () => {
    for (const VERCEL_ENV of ['preview', 'production']) {
      expect(workContractReady({ VERCEL_ENV })).toBe(false);
      expect(workContractReady({ VERCEL_ENV, FOUNDER_WORK_CONTRACT_READY: 'true' })).toBe(false);
      expect(workContractReady({ VERCEL_ENV, FOUNDER_WORK_CONTRACT_READY: '1' })).toBe(true);
    }
  });
  it('retains real local acceptance without creating hosted authority', () => {
    expect(workContractReady({ NODE_ENV: 'development' })).toBe(true);
    expect(workContractReady({ NODE_ENV: 'test' })).toBe(true);
  });
});
