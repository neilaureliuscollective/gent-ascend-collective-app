/** Public catalog navigation only. Never encode saved handles or private preferences. */
export type CatalogView = {
  chapter: string;
  query: string;
  readyOnly: boolean;
  sort: string;
  brandFilter: string;
};
export function readCatalogView(
  search: string,
  chapters: readonly string[],
  brands: readonly string[],
  priceSortSupported: boolean,
  savedOnly = false,
): CatalogView {
  const params = new URLSearchParams(search);
  const chapter = params.get('chapter') ?? (savedOnly ? 'saved' : 'all');
  const sort = params.get('sort') ?? 'featured';
  const brand = params.get('brand') ?? 'all';
  return {
    chapter: chapters.includes(chapter) ? chapter : savedOnly ? 'saved' : 'all',
    query: (params.get('q') ?? '').slice(0, 120),
    readyOnly: params.get('available') === '1',
    sort: ['featured', 'name', ...(priceSortSupported ? ['price-asc', 'price-desc'] : [])].includes(
      sort,
    )
      ? sort
      : 'featured',
    brandFilter: brands.includes(brand) ? brand : 'all',
  };
}
export function catalogViewSearch(search: string, view: CatalogView, savedOnly = false) {
  const params = new URLSearchParams(search);
  const fields = {
    chapter: view.chapter === (savedOnly ? 'saved' : 'all') ? '' : view.chapter,
    q: view.query.slice(0, 120),
    available: view.readyOnly ? '1' : '',
    sort: view.sort === 'featured' ? '' : view.sort,
    brand: view.brandFilter === 'all' ? '' : view.brandFilter,
  };
  for (const [key, value] of Object.entries(fields)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  return params.toString();
}
