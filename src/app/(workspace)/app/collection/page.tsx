import { readLifestyleCatalog } from '@/domains/commerce/lifestyle-catalog';
import { collectionEntries } from '@/domains/commerce/collection';
import { CollectionWorld } from '@/components/commerce/collection-world';
export const metadata = {
  title: 'The Collection — Aethelios Lifestyle',
  robots: { index: false, follow: false },
};
export default async function CollectionPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const savedOnly = (await searchParams).saved === '1';
  const catalog = await readLifestyleCatalog();
  return (
    <CollectionWorld
      key={String(savedOnly)}
      entries={collectionEntries(catalog.products)}
      failed={catalog.status === 'error'}
      savedOnly={savedOnly}
      catalogStatus={catalog.status}
    />
  );
}
