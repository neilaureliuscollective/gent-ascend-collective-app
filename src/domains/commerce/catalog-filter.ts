import type { CollectionEntry } from './collection';

export function filterCatalog(entries: CollectionEntry[], query: string, readyOnly: boolean) {
  const words = query.trim().slice(0, 120).toLocaleLowerCase('en').split(/\s+/).filter(Boolean);
  return entries.filter((entry) => {
    if (readyOnly && entry.orderable !== true) return false;
    // Public catalog language only; no clinical or personalized fit inference.
    const text = `${entry.title} ${entry.kind} ${entry.brand} ${entry.summary}`.toLocaleLowerCase(
      'en',
    );
    return words.every((word) => text.includes(word));
  });
}
