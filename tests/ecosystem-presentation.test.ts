import { describe, expect, it } from 'vitest';
import { calculateCapabilities } from '../src/domains/access/policy';
import { foundingPlans, foundingTiers } from '../src/domains/billing/founding-catalog';
import {
  canOpenPurchase,
  foundingBillingNames,
  isPresentationPlanId,
  presentationPlan,
  presentationPlans,
  presentationPrice,
} from '../src/domains/ecosystem/presentation-catalog';
import { ecosystemTalkStarters, exampleIntent, spaceHref } from '../src/domains/ecosystem/example-intents';
import { recommendPresentation } from '../src/domains/ecosystem/fit';
import {
  parseEcosystemSelection,
  presentationJourney,
  selectionSearch,
} from '../src/domains/ecosystem/selection';

const closed = {
  signedIn: false,
  registrationOpen: false,
  claimReady: false,
  enrollmentOpen: false,
};

describe('Ecosystem presentation catalog', () => {
  it('keeps the proposed preview lineup separate from founding Stripe identifiers', () => {
    expect(presentationPlans.map((plan) => [plan.id, plan.monthlyCents, plan.lifecycle])).toEqual([
      ['access', 0, 'available'],
      ['ascend', 2900, 'preview'],
      ['create', 5900, 'preview'],
      ['architect', 12900, 'preview'],
      ['continuum', 24900, 'coming_soon'],
    ]);
    expect(presentationPrice(presentationPlan('ascend')!)).toBe('$29.00');
    expect(foundingPlans.map((plan) => plan.monthlyCents)).toEqual([1999, 4999, 7499]);
    expect(foundingTiers).toEqual(['essential', 'signature', 'reserve']);
    expect(foundingBillingNames).toEqual(['Essential', 'Signature', 'Reserve']);
    expect(isPresentationPlanId('essential')).toBe(false);
    expect(isPresentationPlanId('signature')).toBe(false);
    expect(presentationPlan('reserve')).toBeUndefined();
  });

  it('never opens purchase for any preview name, including Continuum', () => {
    for (const plan of presentationPlans) {
      expect(canOpenPurchase(plan)).toBe(false);
    }
  });

  it('does not add preview names to access-policy entitlements', () => {
    const now = new Date('2026-10-15T12:00:00Z');
    expect(
      calculateCapabilities(
        { tier: 'essential', billing: 'active', beta: false, accessUntil: '2027-01-01' },
        now,
      ).has('aurelius.context'),
    ).toBe(true);
    expect(() =>
      calculateCapabilities({ tier: 'ascend' as never, billing: 'active', beta: false }, now),
    ).not.toThrow();
    expect(
      calculateCapabilities({ tier: 'free', billing: 'none', beta: false }, now).has('studio.create'),
    ).toBe(false);
  });
});

describe('Find your fit', () => {
  it('recommends the least expensive suitable membership and never auto-selects Continuum as purchasable', () => {
    expect(recommendPresentation('explore', 'occasional').plan.id).toBe('access');
    expect(recommendPresentation('daily', 'ongoing').plan.id).toBe('ascend');
    expect(recommendPresentation('produce', 'occasional').plan.id).toBe('create');
    expect(recommendPresentation('applications', 'ongoing').plan.id).toBe('architect');
    const coordinated = recommendPresentation('coordinate', 'ongoing');
    expect(coordinated.plan.id).toBe('continuum');
    expect(coordinated.availableAlternative?.id).toBe('architect');
    expect(canOpenPurchase(coordinated.plan)).toBe(false);
  });
});

describe('Ecosystem journey', () => {
  it('restores only known selection values', () => {
    const parsed = parseEcosystemSelection({
      intent: 'tool',
      plan: 'continuum',
      note: 'x'.repeat(200),
      goal: 'coordinate',
      cadence: 'ongoing',
    });
    expect(parsed.intent).toBe('tool');
    expect(parsed.plan).toBe('continuum');
    expect(parsed.note).toHaveLength(160);
    expect(parseEcosystemSelection({ intent: 'aurora', plan: 'signature' })).toEqual({
      intent: 'brand',
      plan: null,
      note: '',
      goal: null,
      cadence: null,
    });
    expect(selectionSearch(parsed)).toContain('intent=tool');
  });

  it('keeps Continuum and closed enrollment away from checkout', () => {
    expect(presentationJourney('continuum', { ...closed, enrollmentOpen: true })).toEqual({
      href: null,
      label: 'Continuum is coming soon',
      explanation: 'Coming soon never opens payment. You can keep comparing available memberships.',
      purchase: false,
    });
    expect(presentationJourney('ascend', closed).href).toBe('/membership');
    expect(presentationJourney('ascend', closed).purchase).toBe(false);
    expect(presentationJourney('access', closed).href).toBe('/enter');
    expect(presentationJourney('access', { ...closed, claimReady: true }).href).toBe(
      '/experience/world?claim=1',
    );
    expect(presentationJourney('access', { ...closed, registrationOpen: true }).href).toBe('/join');
    expect(presentationJourney('create', { ...closed, signedIn: true }).href).toBe(
      '/app/membership',
    );
  });

  it('hands Talk a labelled starter and does not invent other transfers', () => {
    expect(spaceHref('talk', 'ecosystem-brand')).toBe('/app/aethelios?starter=ecosystem-brand');
    expect(spaceHref('studio', 'ecosystem-brand')).toBe('/app/studio');
    expect(spaceHref('architect', 'ecosystem-brand')).toBe('/app/architect');
    expect(ecosystemTalkStarters['ecosystem-brand']).toContain('Lumen Atelier');
    expect(exampleIntent('tool').project).toBe('Harbor Ledger');
    expect(exampleIntent('unknown').id).toBe('brand');
  });
});
