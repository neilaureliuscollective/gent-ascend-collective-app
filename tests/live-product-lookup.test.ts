import { describe, expect, it } from 'vitest';
import { createProductLookupRuntime, productLookupTool } from '../src/domains/live/product-lookup';

describe('bounded voice catalog lookup', () => {
  it('advertises a read-only tool with no purchase or identity arguments', () => {
    expect(productLookupTool.name).toBe('lookup_lifestyle_catalog');
    expect(productLookupTool.parameters.additionalProperties).toBe(false);
    expect(Object.keys(productLookupTool.parameters.properties)).toEqual(['question']);
  });

  it('returns grounded states and rejects unsafe or health-only calls', async () => {
    let active = true;
    const runtime = createProductLookupRuntime({
      sessionActive: async () => active,
      catalog: async () => ({
        status: 'ready',
        products: [
          {
            id: 'gid://shopify/Product/1',
            handle: 'beard-oil',
            title: 'Beard Oil',
            availableForSale: true,
            collections: { nodes: [] },
          },
        ],
      }),
      detail: async () => {
        throw new Error('no-store failed');
      },
    });
    const stale = await runtime.run(
      'call-1',
      JSON.stringify({ question: 'Is the beard oil in stock?' }),
    );
    expect(stale.emit).toBe(true);
    expect(stale.output?.status).toBe('stale');
    expect(stale.output?.freshness).toBe('stale-catalog-fallback');

    const duplicate = await runtime.run(
      'call-1',
      JSON.stringify({ question: 'Is the beard oil in stock?' }),
    );
    expect(duplicate).toEqual({ emit: false, output: null });

    const health = await runtime.run(
      'call-2',
      JSON.stringify({ question: 'This rash hurts, what should I do?' }),
    );
    expect(health.output).toMatchObject({ status: 'rejected', reason: 'health-not-commerce' });

    const hostile = await runtime.run(
      'call-3',
      JSON.stringify({ question: 'https://evil.example/catalog', person_id: 'other' }),
    );
    expect(hostile.output?.status).toBe('rejected');

    active = false;
    const late = await runtime.run(
      'call-4',
      JSON.stringify({ question: 'What products do you sell?' }),
    );
    expect(late.output).toMatchObject({ status: 'rejected', reason: 'session-ended' });
  });

  it('does not emit a late result after the session ends during fetch', async () => {
    let active = true;
    const runtime = createProductLookupRuntime({
      sessionActive: async () => active,
      catalog: async () => {
        active = false;
        return { status: 'ready', products: [] };
      },
    });
    const result = await runtime.run(
      'late',
      JSON.stringify({ question: 'What products do you sell?' }),
    );
    expect(result).toEqual({ emit: false, output: null });
  });
});
