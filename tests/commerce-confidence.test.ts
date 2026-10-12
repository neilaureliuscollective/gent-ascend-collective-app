import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { productExcerpt } from '../src/domains/commerce/product-copy';
import { collectionEntries } from '../src/domains/commerce/collection';
import { filterCatalog } from '../src/domains/commerce/catalog-filter';
import { cartLaunchPurchasable } from '../src/domains/commerce/shopify';
import type { Cart, ProductSummary } from '../src/domains/commerce/shopify';

describe('purchase confidence with incomplete merchant content', () => {
  const product: ProductSummary = {
    id: 'gid://shopify/Product/1',
    handle: 'published-product',
    title: 'Synthetic Veil',
    description: 'Daily conditioning. Merchant beard oil description with published ingredients.',
    productType: '',
    vendor: 'Synthetic supplier',
    availableForSale: true,
    requiresSellingPlan: false,
    featuredImage: null,
    collections: { nodes: [] },
    priceRange: { minVariantPrice: { amount: '28', currencyCode: 'USD' } },
  };
  it('finds product-purpose language without inventing a category or changing identity', () => {
    const entries = collectionEntries([product]);
    expect(filterCatalog(entries, 'beard oil', true).map((entry) => entry.handle)).toEqual([
      'published-product',
    ]);
    expect(entries[0]?.discovery).toEqual([]);
    expect(entries[0]?.categories).toEqual([]);
    expect(entries[0]?.brand).toBe('Synthetic supplier');
    expect(entries[0]?.summary).toBe(product.description);
    expect(filterCatalog(entries, 'clinical cure', false)).toEqual([]);
  });
  it('keeps an introductory excerpt short without generating facts', () => {
    const text = 'An approved first sentence. ' + 'Merchant detail '.repeat(40);
    expect(productExcerpt(text)).toBe('An approved first sentence.');
    expect(productExcerpt('word '.repeat(100)).length).toBeLessThanOrEqual(180);
    expect(productExcerpt(undefined)).toBe('');
  });
  it('blocks checkout when a formerly purchasable variant becomes unavailable', () => {
    const cart = {
      lines: {
        nodes: [
          {
            merchandise: {
              availableForSale: false,
              product: { collections: { nodes: [] }, requiresSellingPlan: false },
            },
          },
        ],
      },
    } as unknown as Cart;
    expect(cartLaunchPurchasable(cart)).toBe(false);
  });
});
