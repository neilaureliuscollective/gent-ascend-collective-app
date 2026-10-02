export type CatalogPage<T> = {
  nodes: T[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
};

/** Fail rather than publish a silently incomplete collection. */
export async function collectCatalog<T extends { id: string }>(
  load: (cursor: string | null) => Promise<CatalogPage<T>>,
): Promise<T[]> {
  const entries = new Map<string, T>();
  const cursors = new Set<string>();
  let cursor: string | null = null;
  for (let page = 0; page < 10; page++) {
    const result = await load(cursor);
    if (
      !Array.isArray(result.nodes) ||
      result.nodes.length > 60 ||
      !result.pageInfo ||
      typeof result.pageInfo.hasNextPage !== 'boolean'
    )
      throw new Error('Invalid catalog page');
    for (const item of result.nodes) {
      if (!item || typeof item.id !== 'string' || !item.id) throw new Error('Invalid catalog item');
      entries.set(item.id, item);
    }
    if (!result.pageInfo.hasNextPage) return [...entries.values()];
    const next = result.pageInfo.endCursor;
    if (
      !result.nodes.length ||
      typeof next !== 'string' ||
      !next ||
      next.length > 2000 ||
      cursors.has(next)
    ) {
      throw new Error('Catalog pagination did not advance');
    }
    cursors.add(next);
    cursor = next;
  }
  throw new Error('Catalog exceeds the supported collection size');
}
