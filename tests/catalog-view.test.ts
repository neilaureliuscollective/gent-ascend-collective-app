import { describe, it, expect } from 'vitest';
import { readCatalogView, catalogViewSearch } from '../src/domains/commerce/catalog-view';
const chapters = ['all', 'saved', 'grooming'];
const brands = ['Legacy Reserve'];
describe('public catalog navigation', () => {
  it('round trips real filters and keeps unrelated navigation parameters', () => {
    const view = readCatalogView(
      '?chapter=grooming&q=oil&available=1&sort=price-asc&brand=Legacy+Reserve',
      chapters,
      brands,
      true,
    );
    const search = catalogViewSearch('?campaign=approved', view);
    expect(new URLSearchParams(search).get('campaign')).toBe('approved');
    expect(readCatalogView(search, chapters, brands, true)).toEqual(view);
  });
  it('rejects unsupported chapters, brands and mixed-currency sorts and bounds search', () => {
    expect(
      readCatalogView(
        `?chapter=fiction&brand=fiction&sort=price-desc&available=yes&q=${'a'.repeat(500)}`,
        chapters,
        brands,
        false,
      ),
    ).toEqual({
      chapter: 'all',
      brandFilter: 'all',
      sort: 'featured',
      readyOnly: false,
      query: 'a'.repeat(120),
    });
  });
  it('clears defaults and represents saved view without product identifiers', () => {
    const view = readCatalogView('', chapters, brands, true, true);
    expect(view.chapter).toBe('saved');
    expect(
      catalogViewSearch(
        '?chapter=saved&q=oil&sort=name&brand=Legacy+Reserve&available=1',
        view,
        true,
      ),
    ).toBe('');
    expect(catalogViewSearch('', view)).toBe('chapter=saved');
  });
});
