import type { CollectionEntry } from './collection';
import type { ProductStory } from './product-story';

export const discoveryFocus = [
  { id: 'all', label: 'The whole collection', detail: 'Keep every chapter in view.' },
  { id: 'beard', label: 'Hair & beard', detail: 'Explore the care behind a well-kept beard.' },
  { id: 'hair', label: 'Hair care', detail: 'Explore the foundation of your grooming.' },
  { id: 'body', label: 'Body care', detail: 'Carry the same standard beyond hair and beard.' },
] as const;
export type DiscoveryFocus = (typeof discoveryFocus)[number]['id'];
export type DiscoveryAvailability = 'all' | 'ready';
export function discoverCollection(
  entries: CollectionEntry[],
  focus: DiscoveryFocus,
  availability: DiscoveryAvailability,
) {
  return entries.filter(
    (entry) =>
      (focus === 'all' || entry.discovery?.includes(focus)) &&
      (availability !== 'ready' || entry.orderable === true),
  );
}
export function discoveryReason(entry: CollectionEntry, focus: DiscoveryFocus) {
  if (focus === 'all') return 'Part of the collection you chose to explore.';
  return entry.preview
    ? `Editorial ${focus === 'beard' ? 'hair & beard' : focus} care preview. Final product fit is still being prepared.`
    : `Listed by the merchant under ${focus === 'beard' ? 'hair & beard' : focus} care. Review the product details before choosing.`;
}
/** Resolve only explicit approved editorial relationships, never inferred formula compatibility. */
export function resolveRelated(
  story: ProductStory | null,
  current: string,
  entries: CollectionEntry[],
) {
  const seen = new Set([current]);
  const byHandle = new Map(entries.map((entry) => [entry.handle, entry]));
  return (story?.related ?? []).flatMap((relation) => {
    const entry = byHandle.get(relation.handle);
    if (!entry || seen.has(relation.handle)) return [];
    seen.add(relation.handle);
    return [{ entry, kind: relation.kind, reason: relation.reason }];
  });
}
