import { describe, expect, it } from 'vitest';
import {
  foundingPlans,
  foundingPlan,
  foundingPrice,
} from '../src/domains/billing/founding-catalog';
import { launchPurchaseAllowed, launchState } from '../src/domains/commerce/launch-policy';

describe('founding commercial definitions', () => {
  it('uses the approved three prices, without accepting arbitrary tier identifiers', () => {
    expect(foundingPlans.map((plan) => plan.monthlyCents)).toEqual([1999, 4999, 7499]);
    expect(foundingPrice(foundingPlan('signature')!)).toBe('$49.99');
    expect(foundingPlan('health')).toBeUndefined();
    expect(foundingPlan('__proto__')).toBeUndefined();
  });
});

describe('launch purchase boundary', () => {
  it('preserves ordinary merchandise while denying preview, preorder and unknown states', () => {
    expect(launchPurchaseAllowed({})).toBe(true);
    for (const value of ['preview', 'preorder', '', 'READY', 'unreviewed']) {
      expect(launchPurchaseAllowed({ launchState: { value } })).toBe(false);
    }
    expect(launchPurchaseAllowed({ launchState: { value: 'ready' } })).toBe(true);
  });
  it('uses protective tags even when metadata claims a product is ready', () => {
    expect(launchState({ launchState: { value: 'ready' }, tags: ['Gent-Ascend:Preorder'] })).toBe(
      'preorder',
    );
    expect(launchPurchaseAllowed({ tags: ['gent-ascend:preview'] })).toBe(false);
    expect(launchPurchaseAllowed({ requiresSellingPlan: true })).toBe(false);
  });
});
