import { describe, expect, it } from 'vitest';
import {
  calculateEstimator,
  emptyEstimatorConfig,
  parseDecimal,
  sampleEstimatorConfig,
} from '@/domains/architect-tools/engine';
import { estimatorConfigSchema } from '@/domains/architect-tools/schema';
import { fixtureAgentInvoke } from '@/domains/architect-tools/contract';
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
