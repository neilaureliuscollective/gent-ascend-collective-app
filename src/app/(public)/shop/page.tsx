import type { Metadata } from 'next';
import { commerceConfigured, listProducts } from '@/domains/commerce/shopify';
import { collectionEntries } from '@/domains/commerce/collection';
import { CollectionShowroom } from '@/components/commerce/collection-showroom';
export const metadata: Metadata = {
  title: 'The collection',
  description:
    'Explore the Legacy Reserve collection: considered grooming, product knowledge, and daily rituals within Gent Ascend Collective.',
};
export const revalidate = 300;
export default async function Shop({
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
  const entries = collectionEntries(products, !products.length);
  return (
    <main id="world-main" className="reserve-commerce">
      <CollectionShowroom
        key={String(savedOnly)}
        entries={entries}
        failed={failed}
        savedOnly={savedOnly}
      />
    </main>
  );
}
