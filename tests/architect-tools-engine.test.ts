import { describe, expect, it } from 'vitest';
import {
  calculateEstimator,
  emptyEstimatorConfig,
  parseDecimal,
  sampleEstimatorConfig,
} from '@/domains/architect-tools/engine';
import { estimatorConfigSchema } from '@/domains/architect-tools/schema';
import { fixtureAgentInvoke } from '@/domains/architect-tools/contract';
import { sameJsonValue } from '@/domains/architect-tools/json';
import { initialProject } from '@/domains/architect-origin/schema';

describe('quantity-and-cost estimator', () => {
  it('calculates waste on quantity and markup on cost, not margin', () => {
    const result = calculateEstimator(sampleEstimatorConfig());
    expect(result.subtotal).toBe('310.00');
    expect(result.waste_total).toBe('31.00');
    expect(result.markup_amount).toBe('51.15');
    expect(result.total).toBe('392.15');
    expect(result.implied_margin_percent).toBe('13.04');
    expect(result.assumptions.join(' ')).toMatch(/Markup is not margin/);
    expect(result.assumptions.join(' ')).toMatch(/Sample demonstration/);
  });

  it('rejects zero, negative and incompatible numeric text', () => {
    const config = sampleEstimatorConfig();
    expect(() => calculateEstimator({ ...config, items: [{ ...config.items[0]!, quantity: '0' }] })).toThrow(
      /greater than zero/,
    );
    expect(() =>
      calculateEstimator({ ...config, items: [{ ...config.items[0]!, unit_cost: '-1' }] }),
    ).toThrow(/cannot be negative/);
    expect(() => parseDecimal('1e3', 2, 'Quantity')).toThrow(/plain decimal/);
    expect(() => calculateEstimator({ ...config, waste_percent: '101' })).toThrow(/cannot exceed 100/);
  });

  it('uses half-up rounding and JPY zero-decimal currency', () => {
    const result = calculateEstimator({
      ...sampleEstimatorConfig(),
      currency: 'JPY',
      waste_percent: null,
      markup_percent: null,
      items: [
        {
          id: '00000000-0000-4000-8000-000000000111',
          name: 'Bracket',
          quantity: '3',
          unit: 'each',
          unit_cost: '12',
        },
      ],
    });
    expect(result.total).toBe('36');
    expect(result.lines[0]?.unit_cost).toBe('12');
  });

  it('does not silently fill missing prices and keeps Origin projects compatible', () => {
    const draft = emptyEstimatorConfig();
    expect(estimatorConfigSchema.safeParse(draft).success).toBe(false);
    const origin = initialProject('Existing planning project', 'business');
    expect(origin.discipline).toBe('business');
    expect(Object.keys(origin)).toEqual([
      'name',
      'description',
      'discipline',
      'status',
      'sources',
      'documents',
      'blueprint',
    ]);
  });

  it('applies quantity overrides only for items in the saved revision', () => {
    const config = sampleEstimatorConfig();
    const result = calculateEstimator(config, { [config.items[0]!.id]: '10' });
    expect(result.lines[0]?.quantity).toBe('10.0000');
    expect(() => calculateEstimator(config, { '00000000-0000-4000-8000-000000000999': '1' })).toThrow(
      /not in this saved revision/,
    );
  });

  it('computes quantity waste before monetary rounding so half-cent lines stay consistent', () => {
    const result = calculateEstimator({
      ...sampleEstimatorConfig(),
      waste_percent: '100',
      markup_percent: null,
      items: [
        {
          id: '00000000-0000-4000-8000-000000000111',
          name: 'Washer',
          quantity: '0.5',
          unit: 'each',
          unit_cost: '0.01',
        },
      ],
    });
    expect(result.lines[0]?.effective_quantity).toBe('1.0000');
    expect(result.lines[0]?.extension).toBe('0.01');
    expect(result.lines[0]?.waste).toBe('0.00');
    expect(result.lines[0]?.line_total).toBe('0.01');
    expect(result.total).toBe('0.01');
    expect(result.assumptions.join(' ')).toMatch(/full precision/);
  });

  it('keeps full precision through the monetary boundary', () => {
    const result = calculateEstimator({
      ...sampleEstimatorConfig(),
      waste_percent: '50',
      markup_percent: null,
      items: [
        {
          id: '00000000-0000-4000-8000-000000000111',
          name: 'Fine cut',
          quantity: '0.0001',
          unit: 'tonne',
          unit_cost: '10000',
        },
      ],
    });
    expect(result.lines[0]?.effective_quantity).toBe('0.0002');
    expect(result.lines[0]?.extension).toBe('1.00');
    expect(result.lines[0]?.waste).toBe('0.50');
    expect(result.lines[0]?.line_total).toBe('1.50');
    expect(result.total).toBe('1.50');
  });

  it('agrees on every supported currency and accepted maxima', () => {
    for (const currency of ['USD', 'EUR', 'GBP'] as const) {
      const result = calculateEstimator({
        ...sampleEstimatorConfig(),
        currency,
        waste_percent: null,
        markup_percent: null,
        items: [
          {
            id: '00000000-0000-4000-8000-000000000111',
            name: 'Sheet',
            quantity: '2',
            unit: 'sheet',
            unit_cost: '10.00',
          },
        ],
      });
      expect(result.currency).toBe(currency);
      expect(result.total).toBe('20.00');
    }
    const yen = calculateEstimator({
      ...sampleEstimatorConfig(),
      currency: 'JPY',
      waste_percent: null,
      markup_percent: null,
      items: [
        {
          id: '00000000-0000-4000-8000-000000000111',
          name: 'Bracket',
          quantity: '2',
          unit: 'each',
          unit_cost: '10',
        },
      ],
    });
    expect(yen.total).toBe('20');
    const maximum = calculateEstimator({
      ...sampleEstimatorConfig(),
      waste_percent: '100',
      markup_percent: '1000',
      items: [
        {
          id: '00000000-0000-4000-8000-000000000111',
          name: 'Ceiling',
          quantity: '1000000000',
          unit: 'unit',
          unit_cost: '1000000000',
        },
      ],
    });
    expect(maximum.subtotal).toBe('1000000000000000000.00');
    expect(maximum.waste_total).toBe('1000000000000000000.00');
    expect(maximum.markup_amount).toBe('20000000000000000000.00');
    expect(maximum.total).toBe('22000000000000000000.00');
    expect(() =>
      calculateEstimator({
        ...sampleEstimatorConfig(),
        items: [{ ...sampleEstimatorConfig().items[0]!, quantity: '1000000000.0001' }],
      }),
    ).toThrow(/exceeds the supported range/);
  });

  it('treats reordered JSON as the same calculation and rejects a different total', () => {
    const result = calculateEstimator(sampleEstimatorConfig());
    const reordered = {
      implied_margin_percent: result.implied_margin_percent,
      assumptions: result.assumptions,
      total: result.total,
      markup_amount: result.markup_amount,
      waste_total: result.waste_total,
      subtotal: result.subtotal,
      lines: result.lines.map((line) => ({
        line_total: line.line_total,
        waste: line.waste,
        extension: line.extension,
        unit_cost: line.unit_cost,
        unit: line.unit,
        effective_quantity: line.effective_quantity,
        quantity: line.quantity,
        name: line.name,
        id: line.id,
      })),
      rounding: result.rounding,
      currency: result.currency,
    };
    expect(JSON.stringify(reordered) === JSON.stringify(result)).toBe(false);
    expect(sameJsonValue(reordered, result)).toBe(true);
    expect(sameJsonValue({ ...result, total: '0.00' }, result)).toBe(false);
    expect(sameJsonValue(result.assumptions, [...result.assumptions].reverse())).toBe(false);
    expect(sameJsonValue({ total: '1.50' }, { total: 1.5 })).toBe(false);
  });

  it('rejects invalid quantities and currency precision at the shared save contract', () => {
    const config = sampleEstimatorConfig();
    expect(estimatorConfigSchema.safeParse({ ...config, items: [{ ...config.items[0]!, quantity: '0' }] }).success).toBe(
      false,
    );
    expect(
      estimatorConfigSchema.safeParse({
        ...config,
        currency: 'USD',
        items: [{ ...config.items[0]!, unit_cost: '0.001' }],
      }).success,
    ).toBe(false);
    expect(
      estimatorConfigSchema.safeParse({
        ...config,
        currency: 'JPY',
        items: [{ ...config.items[0]!, unit_cost: '12.5' }],
      }).success,
    ).toBe(false);
    expect(estimatorConfigSchema.safeParse({ ...config, waste_percent: '101' }).success).toBe(false);
  });

  it('labels unauthorized agent-fixture scope as a refusal', () => {
    expect(fixtureAgentInvoke({ authorized: false, projectId: 'p', toolId: 't', revision: 1 }).ok).toBe(
      false,
    );
    expect(
      fixtureAgentInvoke({
        authorized: true,
        projectId: '00000000-0000-4000-8000-000000000003',
        toolId: '00000000-0000-4000-8000-000000000030',
        revision: 1,
      }).ok,
    ).toBe(true);
  });
});
