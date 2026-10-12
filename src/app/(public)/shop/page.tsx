import { readLifestyleCatalog } from '@/domains/commerce/lifestyle-catalog';
import { collectionEntries } from '@/domains/commerce/collection';
import { CollectionWorld } from '@/components/commerce/collection-world';
export const metadata = { title: 'Collection — Aethelios Lifestyle' };
export default async function Shop({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const catalog = await readLifestyleCatalog();
  return (
    <main id="world-main">
      <CollectionWorld
        entries={collectionEntries(catalog.products)}
        failed={catalog.status === 'error'}
        catalogStatus={catalog.status}
        savedOnly={(await searchParams).saved === '1'}
        basePath="/shop"
      />
    </main>
  );
}
