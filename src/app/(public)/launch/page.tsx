import type { Metadata } from 'next';
import { Suspense } from 'react';
import { commerceConfigured, listProducts } from '@/domains/commerce/shopify';
import { collectionEntries } from '@/domains/commerce/collection';
import { CollectionShowroom } from '@/components/commerce/collection-showroom';
export const metadata: Metadata = {
  title: 'The launch collection',
  description: 'Explore the first releases, their formulas, rituals, and confirmed availability.',
};
export const revalidate = 300;
export default async function Launch() {
  let failed = false;
  const products = commerceConfigured()
    ? await listProducts().catch(() => {
        failed = true;
        return [];
      })
    : [];
  return (
    <main id="world-main" className="reserve-commerce">
      <Suspense fallback={<p className="reserve-loading">Opening the first chapter…</p>}>
        <CollectionShowroom
          entries={collectionEntries(products, true)}
          failed={failed}
          title="The launch collection"
        />
      </Suspense>
    </main>
  );
}
