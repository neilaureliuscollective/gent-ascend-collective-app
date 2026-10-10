import { readLifestyleCatalog } from '@/domains/commerce/lifestyle-catalog';
import { collectionEntries } from '@/domains/commerce/collection';
import { CollectionWorld } from '@/components/commerce/collection-world';
export const metadata = { title: 'Legacy Reserve — Aethelios Lifestyle' };
export default async function LegacyReservePage() {
  const catalog = await readLifestyleCatalog();
  return (
    <CollectionWorld
      entries={collectionEntries(catalog.products)}
      failed={catalog.status === 'error'}
      brand="Legacy Reserve"
      catalogStatus={catalog.status}
    />
  );
}
