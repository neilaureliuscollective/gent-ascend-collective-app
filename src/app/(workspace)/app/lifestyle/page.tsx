import { readLifestyleCatalog } from '@/domains/commerce/lifestyle-catalog';
import { collectionEntries } from '@/domains/commerce/collection';
import { MemberLifestyleHome } from '@/components/commerce/member-lifestyle-home';
import { CabinetError, cabinetWorkspace } from '@/domains/commerce/cabinet';
import type { MemberLifestyleCabinet } from '@/domains/commerce/member-lifestyle';

export const metadata = { title: 'Aethelios Lifestyle' };

async function readCabinetPreview(): Promise<MemberLifestyleCabinet> {
  try {
    const data = await cabinetWorkspace(0);
    return {
      available: true,
      records: data.records.map((record) => ({
        id: record.id,
        name: record.name,
        relation: record.relation,
        shopify_handle: record.shopify_handle,
      })),
      ritualCount: data.rituals.length,
    };
  } catch (error) {
    if (error instanceof CabinetError) return { available: false, records: [], ritualCount: 0 };
    throw error;
  }
}

export default async function LifestylePage() {
  const [catalog, cabinet] = await Promise.all([readLifestyleCatalog(), readCabinetPreview()]);
  return (
    <MemberLifestyleHome
      entries={collectionEntries(catalog.products)}
      status={catalog.status}
      cabinet={cabinet}
    />
  );
}
