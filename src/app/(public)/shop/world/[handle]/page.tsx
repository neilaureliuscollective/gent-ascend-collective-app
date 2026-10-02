import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { commerceConfigured, listProducts } from '@/domains/commerce/shopify';
import { collectionEntries } from '@/domains/commerce/collection';
import { CollectionShowroom } from '@/components/commerce/collection-showroom';
const worlds: Record<string, string> = {
  grooming: 'Grooming',
  performance: 'Performance',
  recovery: 'Recovery',
  'daily-ritual': 'Daily Ritual',
};
export const revalidate = 300;
export default async function World({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  if (!commerceConfigured() || !worlds[handle]) notFound();
  const products = (await listProducts()).filter((product) =>
    product.collections.nodes.some((collection) => collection.handle === handle),
  );
  if (!products.length) notFound();
  return (
    <main id="world-main" className="reserve-commerce">
      <Suspense fallback={<p className="reserve-loading">Opening the collection…</p>}>
        <CollectionShowroom
          entries={collectionEntries(products)}
          title={worlds[handle]}
          fixedWorld={handle}
        />
      </Suspense>
    </main>
  );
}
