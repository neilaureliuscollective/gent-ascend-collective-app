import { readLifestyleCatalog } from '@/domains/commerce/lifestyle-catalog';
import { collectionEntries } from '@/domains/commerce/collection';
import { LifestyleLanding } from '@/components/commerce/lifestyle-landing';
export const metadata = { title: 'Aethelios Lifestyle' };
export default async function LifestylePage() {
  const catalog = await readLifestyleCatalog();
  return <LifestyleLanding entries={collectionEntries(catalog.products)} status={catalog.status} />;
}
