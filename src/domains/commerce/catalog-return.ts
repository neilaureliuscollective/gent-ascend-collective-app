/** Last collection list location for product return. Public URL context only. */
const STORAGE_KEY = 'aethelios-catalog-return';

const LIST_PATHS = new Set([
  '/app/collection',
  '/app/lifestyle/legacy-reserve',
  '/shop',
  '/lifestyle/legacy-reserve',
]);

export function isCatalogListPath(pathname: string) {
  return LIST_PATHS.has(pathname);
}

export type CatalogReturn = {
  href: string;
  scroll: number;
};

export function catalogReturnFromLocation(pathname: string, search: string, scroll: number) {
  if (!isCatalogListPath(pathname)) return null;
  if (!Number.isFinite(scroll) || scroll < 0) return null;
  return { href: `${pathname}${search}`, scroll: Math.floor(scroll) } satisfies CatalogReturn;
}

export function parseCatalogReturn(raw: string, origin: string): CatalogReturn | null {
  try {
    const parsed = JSON.parse(raw) as { href?: unknown; scroll?: unknown };
    if (typeof parsed.href !== 'string' || typeof parsed.scroll !== 'number') return null;
    if (!Number.isFinite(parsed.scroll) || parsed.scroll < 0) return null;
    const url = new URL(parsed.href, origin);
    if (url.origin !== origin || url.username || url.password) return null;
    if (!isCatalogListPath(url.pathname)) return null;
    return { href: `${url.pathname}${url.search}`, scroll: Math.floor(parsed.scroll) };
  } catch {
    return null;
  }
}

export function rememberCatalogReturn() {
  if (typeof window === 'undefined') return;
  const record = catalogReturnFromLocation(
    window.location.pathname,
    window.location.search,
    window.scrollY,
  );
  if (!record) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    /* Discovery still works without restored scroll. */
  }
}

export function readCatalogReturn(fallback: string) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    return parseCatalogReturn(raw, window.location.origin)?.href ?? fallback;
  } catch {
    return fallback;
  }
}

export function matchingCatalogScroll(currentHref: string) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const record = parseCatalogReturn(raw, window.location.origin);
    if (!record || record.href !== currentHref) return null;
    return record.scroll;
  } catch {
    return null;
  }
}
