import type { Metadata } from 'next';
import { commerceConfigured, listProducts } from '@/domains/commerce/shopify';
import { collectionEntries } from '@/domains/commerce/collection';
import { CollectionWorld } from '@/components/commerce/collection-world';
export const metadata: Metadata = {
  title: 'The Collection',
  robots: { index: false, follow: false },
};
export default async function CollectionPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const savedOnly = (await searchParams).saved === '1';
  let failed = false;
  const products = commerceConfigured()
    ? await listProducts().catch(() => {
        failed = true;
        return [];
      })
    : [];
  return (
    <CollectionWorld
      key={String(savedOnly)}
      entries={collectionEntries(products, !products.length)}
      failed={failed}
      savedOnly={savedOnly}
    />
  );
}
