import { describe, expect, it } from 'vitest';
import {
  brandProducts,
  lifestyleCollectionHandle,
  memberCommerceBenefit,
  productBrand,
} from '../src/domains/commerce/lifestyle';
import { publicCart, verifiedCheckoutUrl } from '../src/domains/commerce/cart-public';
import type { Cart } from '../src/domains/commerce/shopify';

describe('Lifestyle assortment and benefits', () => {
  it('includes only products in the merchant-selected collection', () => {
    const products = [
      {
        id: 'approved',
        collections: { nodes: [{ handle: 'legacy-reserve', title: 'Legacy Reserve' }] },
      },
      { id: 'unrelated', collections: { nodes: [{ handle: 'other', title: 'Legacy products' }] } },
    ];
    expect(brandProducts(products, 'legacy-reserve').map((p) => p.id)).toEqual(['approved']);
    expect(brandProducts(products, 'missing')).toEqual([]);
    expect(lifestyleCollectionHandle()).toBe('legacy-reserve');
    expect(() => lifestyleCollectionHandle('bad/handle')).toThrow();
  });
  it('preserves supplier identity and promises no unenforced discount', () => {
    expect(productBrand({ vendor: 'Actual supplier', collections: { nodes: [] } })).toBe(
      'Actual supplier',
    );
    expect(memberCommerceBenefit()).toEqual({
      active: false,
      priceSource: 'shopify',
      discount: null,
    });
  });
});
describe('browser commerce boundary', () => {
  it('returns Shopify totals and line IDs without the cart key or checkout URL', () => {
    const cart = {
      id: 'gid://shopify/Cart/test?key=private',
      checkoutUrl: 'https://store.myshopify.com/checkout/private',
      totalQuantity: 2,
      cost: { totalAmount: { amount: '34.00', currencyCode: 'USD' } },
      lines: { nodes: [] },
      warnings: [],
    } as unknown as Cart;
    const visible = publicCart(cart);
    expect(visible?.cost).toEqual(cart.cost);
    expect(JSON.stringify(visible)).not.toContain('private');
    expect(visible).not.toHaveProperty('id');
    expect(visible).not.toHaveProperty('checkoutUrl');
    expect(publicCart(null)).toBeNull();
  });
  it('accepts only exact HTTPS checkout hosts with no credentials or ports', () => {
    const hosts = ['store.myshopify.com'];
    expect(verifiedCheckoutUrl('https://store.myshopify.com/checkouts/abc', hosts).hostname).toBe(
      hosts[0],
    );
    for (const url of [
      'http://store.myshopify.com/checkout',
      'https://store.myshopify.com.evil.test',
      'https://user:secret@store.myshopify.com',
      'https://store.myshopify.com:444/checkout',
      'javascript:alert(1)',
    ])
      expect(() => verifiedCheckoutUrl(url, hosts)).toThrow();
  });
});
