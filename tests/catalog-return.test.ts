import { describe, expect, it } from 'vitest';
import {
  catalogContextFromPath,
  catalogReturnFromLocation,
  isCatalogListPath,
  normalizeCatalogListPath,
  parseCatalogReturn,
} from '../src/domains/commerce/catalog-return';

describe('catalog return context', () => {
  it('accepts only collection list paths', () => {
    expect(isCatalogListPath('/app/collection')).toBe(true);
    expect(isCatalogListPath('/app/lifestyle/legacy-reserve')).toBe(true);
    expect(isCatalogListPath('/shop')).toBe(true);
    expect(isCatalogListPath('/app/collection/fixture-oil')).toBe(false);
    expect(isCatalogListPath('/lifestyle')).toBe(false);
    expect(isCatalogListPath('https://evil.test/app/collection')).toBe(false);
  });

  it('stores the current list query and rejects other routes', () => {
    expect(catalogReturnFromLocation('/app/collection', '?q=oil&chapter=grooming', 240)).toEqual({
      href: '/app/collection?q=oil&chapter=grooming',
      scroll: 240,
      context: 'member',
    });
    expect(catalogReturnFromLocation('/app/collection/fixture-oil', '', 10)).toBeNull();
    expect(catalogReturnFromLocation('/app/collection', '', Number.NaN)).toBeNull();
  });

  it('aliases retired brand list URLs to the current collection', () => {
    expect(normalizeCatalogListPath('/app/lifestyle/legacy-reserve')).toBe('/app/collection');
    expect(normalizeCatalogListPath('/lifestyle/legacy-reserve')).toBe('/shop');
    expect(catalogReturnFromLocation('/lifestyle/legacy-reserve', '?chapter=grooming', 40)).toEqual({
      href: '/shop?chapter=grooming',
      scroll: 40,
      context: 'public',
    });
  });

  it('rejects absolute URLs, credentials and unknown paths', () => {
    const origin = 'https://aethelios.example';
    expect(
      parseCatalogReturn(JSON.stringify({ href: '/app/collection?q=balm', scroll: 80 }), origin),
    ).toEqual({ href: '/app/collection?q=balm', scroll: 80, context: 'member' });
    expect(
      parseCatalogReturn(
        JSON.stringify({ href: 'https://evil.test/app/collection', scroll: 1 }),
        origin,
      ),
    ).toBeNull();
    expect(
      parseCatalogReturn(
        JSON.stringify({ href: 'https://user:secret@aethelios.example/app/collection', scroll: 1 }),
        origin,
      ),
    ).toBeNull();
    expect(parseCatalogReturn(JSON.stringify({ href: '/app/talk', scroll: 1 }), origin)).toBeNull();
  });

  it('does not restore a public destination inside the member collection', () => {
    const origin = 'https://aethelios.example';
    const stored = JSON.stringify({ href: '/shop?q=oil', scroll: 90, context: 'public' });
    expect(parseCatalogReturn(stored, origin, 'member')).toBeNull();
    expect(parseCatalogReturn(stored, origin, 'public')).toEqual({
      href: '/shop?q=oil',
      scroll: 90,
      context: 'public',
    });
    expect(catalogContextFromPath('/app/collection/fixture-oil')).toBe('member');
    expect(catalogContextFromPath('/shop/fixture-oil')).toBe('public');
  });
});
