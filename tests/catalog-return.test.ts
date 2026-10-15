import { describe, expect, it } from 'vitest';
import {
  catalogReturnFromLocation,
  isCatalogListPath,
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
    });
    expect(catalogReturnFromLocation('/app/collection/fixture-oil', '', 10)).toBeNull();
    expect(catalogReturnFromLocation('/app/collection', '', Number.NaN)).toBeNull();
  });

  it('rejects absolute URLs, credentials and unknown paths', () => {
    const origin = 'https://aethelios.example';
    expect(
      parseCatalogReturn(JSON.stringify({ href: '/app/collection?q=balm', scroll: 80 }), origin),
    ).toEqual({ href: '/app/collection?q=balm', scroll: 80 });
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
});
