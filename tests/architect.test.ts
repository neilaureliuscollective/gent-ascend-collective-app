import { describe, it, expect } from 'vitest';
import { scaffold, parseProject, checkProject, exportDocument } from '@/domains/architect/project';
import { resolveProductCapabilities } from '@/domains/access/launch-contract';
import { validateLaunchTestPrice } from '@/domains/billing/launch-price';
import { launchPlans } from '@/domains/billing/launch-catalog';
describe('Architect deliverables', () => {
  it('round trips real source and escapes the prompt without treating it as code', () => {
    const p = scaffold('An idea', '<script>alert(1)</script>');
    expect(p.html).toContain('&lt;script&gt;');
    expect(parseProject(JSON.parse(JSON.stringify(p)))).toEqual(p);
    expect(checkProject(p)).toEqual([]);
    expect(exportDocument(p)).toContain('<!doctype html>');
  });
  it('rejects oversized/malformed imports and flags active content', () => {
    const p = scaffold('Test', 'brief');
    expect(() => parseProject({ ...p, html: 'x'.repeat(40001) })).toThrow();
    expect(() => parseProject({ ...p, version: 2 })).toThrow();
    expect(checkProject({ ...p, html: '<script>fetch("https://example.com")</script>' })).toEqual(
      expect.arrayContaining([
        'Add an h1 heading.',
        'Add a main landmark.',
        'External resources are blocked in the preview.',
      ]),
    );
  });
});
describe('launch compatibility', () => {
  it('publishes exactly the four approved prices', () =>
    expect(launchPlans.map((p) => [p.id, p.monthlyCents])).toEqual([
      ['access', 0],
      ['essential', 1999],
      ['signature', 4999],
      ['architect', 12900],
    ]));
  it('preserves legacy paid access and never grants an agent or clinical care', () => {
    const now = new Date('2026-10-10');
    const grants = resolveProductCapabilities(
      { tier: 'reserve', billing: 'active', beta: false, accessUntil: '2026-11-10' },
      now,
    );
    expect(grants.has('studio.create')).toBe(true);
    expect(grants.has('architect.agent')).toBe(false);
    expect(grants.has('clinical.care')).toBe(false);
    expect(
      resolveProductCapabilities(
        { tier: 'signature', billing: 'active', beta: false, accessUntil: '2026-10-09' },
        now,
      ).has('studio.create'),
    ).toBe(false);
  });
  it('fails closed for live, wrong amount, duplicate id or unsupported recurring prices', () => {
    const price = {
      id: 'price_architect',
      active: true,
      livemode: false,
      currency: 'usd',
      unit_amount: 12900,
      recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' },
    };
    expect(validateLaunchTestPrice('architect', price.id, price)).toBe(true);
    for (const changed of [
      { ...price, livemode: true },
      { ...price, unit_amount: 7499 },
      { ...price, currency: 'eur' },
      { ...price, active: false },
      { ...price, recurring: null },
      { ...price, id: 'price_other' },
    ])
      expect(validateLaunchTestPrice('architect', price.id, changed)).toBe(false);
  });
});
