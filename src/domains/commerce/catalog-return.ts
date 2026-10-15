/** Last collection list location for product return. Scoped to public or member URL context. */
const STORAGE_KEY = 'aethelios-catalog-return';

const LIST_PATHS = new Set([
  '/app/collection',
  '/app/lifestyle/legacy-reserve',
  '/shop',
  '/lifestyle/legacy-reserve',
]);

const PATH_ALIASES: Record<string, string> = {
  '/app/lifestyle/legacy-reserve': '/app/collection',
  '/lifestyle/legacy-reserve': '/shop',
};

export type CatalogContext = 'public' | 'member';

export type CatalogReturn = {
  href: string;
  scroll: number;
  context: CatalogContext;
};

export function catalogContextFromPath(pathname: string): CatalogContext | null {
  if (pathname.startsWith('/app/')) return 'member';
  if (
    pathname === '/shop' ||
    pathname.startsWith('/shop/') ||
    pathname === '/lifestyle' ||
    pathname.startsWith('/lifestyle/')
  )
    return 'public';
  return null;
}

export function isCatalogListPath(pathname: string) {
  return LIST_PATHS.has(pathname);
}

export function normalizeCatalogListPath(pathname: string) {
  return PATH_ALIASES[pathname] ?? pathname;
}

export function catalogReturnFromLocation(pathname: string, search: string, scroll: number) {
  if (!isCatalogListPath(pathname)) return null;
  if (!Number.isFinite(scroll) || scroll < 0) return null;
  const hrefPath = normalizeCatalogListPath(pathname);
  const context = catalogContextFromPath(hrefPath);
  if (!context) return null;
  return { href: `${hrefPath}${search}`, scroll: Math.floor(scroll), context } satisfies CatalogReturn;
}

export function parseCatalogReturn(
  raw: string,
  origin: string,
  expectedContext?: CatalogContext | null,
): CatalogReturn | null {
  try {
    const parsed = JSON.parse(raw) as { href?: unknown; scroll?: unknown; context?: unknown };
    if (typeof parsed.href !== 'string' || typeof parsed.scroll !== 'number') return null;
    if (!Number.isFinite(parsed.scroll) || parsed.scroll < 0) return null;
    const url = new URL(parsed.href, origin);
    if (url.origin !== origin || url.username || url.password) return null;
    if (!isCatalogListPath(url.pathname)) return null;
    const pathname = normalizeCatalogListPath(url.pathname);
    const context =
      parsed.context === 'public' || parsed.context === 'member'
        ? parsed.context
        : catalogContextFromPath(pathname);
    if (!context) return null;
    if (expectedContext && context !== expectedContext) return null;
    return { href: `${pathname}${url.search}`, scroll: Math.floor(parsed.scroll), context };
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
    const expected =
      catalogContextFromPath(new URL(fallback, window.location.origin).pathname) ??
      catalogContextFromPath(window.location.pathname);
    return parseCatalogReturn(raw, window.location.origin, expected)?.href ?? fallback;
  } catch {
    return fallback;
  }
}

export function matchingCatalogScroll(currentHref: string) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const expected = catalogContextFromPath(window.location.pathname);
    const record = parseCatalogReturn(raw, window.location.origin, expected);
    if (!record || record.href !== currentHref) return null;
    return record.scroll;
  } catch {
    return null;
  }
}
