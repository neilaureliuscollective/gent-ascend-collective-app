import { describe, expect, it } from 'vitest';
import { commerceFixture } from './component-fixture/commerce';
import { productPath } from '../src/domains/commerce/product-path';
import {
  productStructuredData,
  publicCommerceOrigin,
  safeStructuredJson,
} from '../src/domains/commerce/product-sharing';

describe('public product sharing contract', () => {
  it('rejects unsafe handles and origin configuration', () => {
    expect(productPath('vitalis')).toBe('/shop/vitalis');
    for (const handle of ['../app', 'vitalis?token=secret', 'https://evil.test', 'a'.repeat(121)])
      expect(productPath(handle)).toBeNull();
    expect(publicCommerceOrigin('https://gent.example/')).toBe('https://gent.example');
    for (const origin of [
      undefined,
      'http://gent.example',
      'https://user:secret@gent.example',
      'https://gent.example/private',
      'https://gent.example/?token=secret',
    ])
      expect(publicCommerceOrigin(origin)).toBeNull();
  });
  it('uses real variant prices and stock while excluding preview offers and unsafe media', () => {
    const data = productStructuredData(commerceFixture, 'https://gent.example');
    expect(data?.offers?.map((offer) => offer.price)).toEqual(['24.00', '38.00']);
    expect(data?.offers?.[0]?.availability).toBe('https://schema.org/InStock');
    expect(
      productStructuredData({ ...commerceFixture, availableForSale: false }, 'https://gent.example')
        ?.offers?.[0]?.availability,
    ).toBe('https://schema.org/OutOfStock');
    for (const state of ['preview', 'preorder', 'invalid'])
      expect(
        productStructuredData(
          { ...commerceFixture, launchState: { value: state } },
          'https://gent.example',
        ),
      ).not.toHaveProperty('offers');
    expect(
      productStructuredData({ ...commerceFixture, story: null }, 'https://gent.example'),
    ).toHaveProperty('image', [commerceFixture.featuredImage!.url]);
    expect(
      productStructuredData(
        {
          ...commerceFixture,
          featuredImage: {
            ...commerceFixture.featuredImage!,
            url: 'https://untrusted.example/image.jpg',
          },
        },
        'https://gent.example',
      ),
    ).not.toHaveProperty('image');
    expect(productStructuredData(commerceFixture, null)).toBeNull();
    expect(data).not.toHaveProperty('aggregateRating');
    expect(data).not.toHaveProperty('review');
  });
  it('never serializes malicious markup into an executable script or malformed prices into offers', () => {
    const text = '</script><script>alert(1)</script>';
    const json = safeStructuredJson({ name: text });
    expect(json).not.toContain('<');
    expect(JSON.parse(json).name).toBe(text);
    const data = productStructuredData(
      {
        ...commerceFixture,
        variants: {
          nodes: [
            {
              ...commerceFixture.variants.nodes[0]!,
              price: { amount: 'Infinity', currencyCode: 'USD' },
            },
          ],
        },
      },
      'https://gent.example',
    );
    expect(data).not.toHaveProperty('offers');
  });
});
