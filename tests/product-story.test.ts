import { describe, expect, it } from 'vitest';
import { readProductStory, shopifyMediaUrl } from '../src/domains/commerce/product-story';

describe('merchant product education boundary', () => {
  it('publishes only versioned approved structured facts', () => {
    const story = readProductStory({
      value: JSON.stringify({
        version: 1,
        status: 'approved',
        size: '30 ml',
        highlights: [{ name: 'Jojoba', role: 'Manufacturer-approved ingredient role.' }],
      }),
    });
    expect(story?.highlights[0]?.name).toBe('Jojoba');
    expect(story?.mediaApproved).toBe(false);
    expect(
      readProductStory({ value: JSON.stringify({ version: 1, status: 'draft', size: '30 ml' }) }),
    ).toBeNull();
    expect(
      readProductStory({ value: JSON.stringify({ version: 2, status: 'approved' }) }),
    ).toBeNull();
  });
  it('fails closed on malformed, oversized and commerce/privilege fields', () => {
    for (const value of [
      '{bad',
      'x'.repeat(20001),
      JSON.stringify({ version: 1, status: 'approved', memberPrice: 1 }),
      JSON.stringify({ version: 1, status: 'approved', role: 'founder' }),
      JSON.stringify({ version: 1, status: 'approved', size: '<x>'.repeat(200) }),
    ])
      expect(readProductStory({ value })).toBeNull();
  });
  it('keeps supplement facts separate and supports multiline approved content', () => {
    const story = readProductStory({
      value: JSON.stringify({
        version: 1,
        status: 'approved',
        factsLabel: 'Supplement Facts',
        cautions: 'Use manufacturer directions.\nCheck the label.',
      }),
    });
    expect(story?.factsLabel).toBe('Supplement Facts');
    expect(story?.cautions).toContain('\n');
  });
  it('allows only secure Shopify CDN media URLs', () => {
    expect(shopifyMediaUrl('https://cdn.shopify.com/s/files/1/product.glb')).toBe(true);
    for (const url of [
      'https://cdn.shopify.com.evil.test/file.glb',
      'http://cdn.shopify.com/file.glb',
      'javascript:alert(1)',
      'https://user:pass@cdn.shopify.com/file.glb',
      '/file.glb',
    ])
      expect(shopifyMediaUrl(url)).toBe(false);
  });
});
