import { describe, expect, it } from 'vitest';
import {
  chooseVariant,
  healthConcernAlone,
  loadProductKnowledge,
  productKnowledgeMode,
} from '../src/domains/intelligence/product-knowledge';
import { selectPlaybooks } from '../src/domains/intelligence/playbooks';

const oil = {
  id: 'gid://shopify/Product/1',
  handle: 'beard-oil',
  title: 'Beard Oil',
  availableForSale: true,
  collections: { nodes: [] },
};
const serum = {
  id: 'gid://shopify/Product/2',
  handle: 'serum',
  title: 'Serum',
  availableForSale: true,
  collections: { nodes: [] },
};

function catalog(...products: (typeof oil)[]) {
  return { status: 'ready' as const, products };
}

describe('latest product intent and unique variants', () => {
  it('lets a current product choice outrank an older mention', async () => {
    const switched = await loadProductKnowledge(
      'Tell me about the serum',
      {
        catalog: async () => catalog(oil, serum),
        detail: async (handle) =>
          handle === 'serum' ? { ...serum, variants: { nodes: [] } } : oil,
      },
      { recentUserTexts: ['Tell me about Beard Oil in /shop/beard-oil'] },
    );
    expect(switched?.records.map((record) => record.handle)).toEqual(['serum']);
    expect(switched?.unresolved).toBe(false);
  });

  it('resolves “that one” to the latest user product, not an older assistant recommendation', async () => {
    const follow = await loadProductKnowledge(
      'What are the ingredients in that one?',
      {
        catalog: async () => catalog(oil, serum),
        detail: async (handle) =>
          handle === 'serum'
            ? { ...serum, ingredients: { value: 'Niacinamide' }, variants: { nodes: [] } }
            : { ...oil, ingredients: { value: 'Jojoba' }, variants: { nodes: [] } },
      },
      { recentUserTexts: ['Tell me about Beard Oil', 'Switch to the serum'] },
    );
    expect(
      productKnowledgeMode('What are the ingredients in that one?', 'Switch to the serum'),
    ).toBe('follow-up');
    expect(follow?.records[0]?.handle).toBe('serum');
    expect(follow?.records[0]?.ingredients).toBe('Niacinamide');
  });

  it('asks one question when similar variants share a dimension', () => {
    const variants = [
      {
        variantId: 'gid://shopify/ProductVariant/30',
        title: '30ml Unscented',
        price: { amount: '32.00', currencyCode: 'USD', source: 'shopify' as const },
        availableForSale: false,
        currentlyNotInStock: true,
        purchasable: false,
      },
      {
        variantId: 'gid://shopify/ProductVariant/50',
        title: '50ml Unscented',
        price: { amount: '48.00', currencyCode: 'USD', source: 'shopify' as const },
        availableForSale: true,
        currentlyNotInStock: false,
        purchasable: true,
      },
    ];
    expect(chooseVariant(variants, '50ml unscented')).toEqual({
      selectedVariantId: 'gid://shopify/ProductVariant/50',
      needsVariantChoice: false,
    });
    expect(chooseVariant(variants, '50 ml unscented').selectedVariantId).toBe(
      'gid://shopify/ProductVariant/50',
    );
    expect(chooseVariant(variants, 'unscented')).toEqual({
      selectedVariantId: null,
      needsVariantChoice: true,
    });
    expect(
      chooseVariant(
        [
          { ...variants[0]!, variantId: 'scented', title: '30ml Scented' },
          { ...variants[1]!, variantId: 'unscented', title: '30ml Unscented' },
        ],
        'scented',
      ).selectedVariantId,
    ).toBe('scented');
  });

  it('leaves a tied current reference unresolved instead of picking catalog order', async () => {
    const cedar = {
      ...oil,
      id: 'gid://shopify/Product/11',
      handle: 'cedar-oil',
      title: 'Cedar Oil',
    };
    const argan = {
      ...oil,
      id: 'gid://shopify/Product/12',
      handle: 'argan-oil',
      title: 'Argan Oil',
    };
    const unclear = await loadProductKnowledge(
      'What are the ingredients in that one?',
      {
        catalog: async () => catalog(cedar, argan),
        detail: async (handle) =>
          handle === 'cedar-oil'
            ? { ...cedar, variants: { nodes: [] } }
            : { ...argan, variants: { nodes: [] } },
      },
      { recentUserTexts: ['Tell me about Cedar Oil and Argan Oil'] },
    );
    expect(unclear?.unresolved).toBe(true);
    expect(unclear?.clarifyingQuestion).toMatch(/which product/i);

    const named = await loadProductKnowledge('Tell me about Beard Oil', {
      catalog: async () =>
        catalog(oil, {
          ...oil,
          id: 'gid://shopify/Product/3',
          handle: 'beard-balm',
          title: 'Beard Balm',
        }),
      detail: async (handle) =>
        handle === 'beard-oil' ? { ...oil, variants: { nodes: [] } } : null,
    });
    expect(named?.records.map((record) => record.handle)).toEqual(['beard-oil']);
    expect(named?.unresolved).toBe(false);
  });

  it('does not treat a health concern alone as a commerce lookup', () => {
    expect(healthConcernAlone('This rash hurts and I feel feverish.')).toBe(true);
    expect(healthConcernAlone('Diagnose this rash and tell me the oil will cure it.')).toBe(false);
  });
});

describe('playbooks follow current intent', () => {
  it('drops product guidance after a topic change and leaves casual talk empty', () => {
    expect(
      selectPlaybooks('Make this feel premium', null, 2, {
        recentUserTexts: ['What is in the beard oil?'],
      }).map((item) => item.id),
    ).toEqual(['studio']);
    expect(selectPlaybooks('Good morning').map((item) => item.id)).toEqual([]);
    expect(
      selectPlaybooks('Use the second direction', null, 2, {
        recentUserTexts: ['Give me three bold directions'],
      }).map((item) => item.id),
    ).toContain('talk');
  });
});
