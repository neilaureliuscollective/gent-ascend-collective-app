import type { CollectionEntry } from './collection';
import { lifestyleBrands } from './lifestyle';
import { cabinetLabels, type CabinetRelation, type CabinetRow } from './cabinet-model';

const chapters = [
  ['grooming', 'Grooming'],
  ['performance', 'Performance'],
  ['recovery', 'Recovery'],
  ['daily-ritual', 'Daily ritual'],
] as const;

export type MemberCabinetRecord = Pick<CabinetRow, 'id' | 'name' | 'relation' | 'shopify_handle'>;

export type MemberLifestyleCabinet = {
  available: boolean;
  records: MemberCabinetRecord[];
  ritualCount: number;
};

export function memberCatalogDestinations(entries: CollectionEntry[]) {
  const brands = [...new Set(entries.map((entry) => entry.brand).filter(Boolean))].sort();
  return {
    brands,
    chapters: chapters.filter(([id]) => entries.some((entry) => entry.categories.includes(id))),
    flagship: lifestyleBrands.filter((brand) =>
      entries.some(
        (entry) => entry.brand === brand.name || entry.categories.includes(brand.collectionHandle),
      ),
    ),
  };
}

export function memberCabinetPreview(records: MemberCabinetRecord[]) {
  return records.slice(0, 4).map((record) => ({
    ...record,
    label: cabinetLabels[record.relation as CabinetRelation] ?? record.relation,
  }));
}

export function memberGroomingState(cabinet: MemberLifestyleCabinet) {
  const kept = cabinet.records.filter((record) =>
    ['owned', 'in_use', 'favorite', 'running_low'].includes(record.relation),
  ).length;
  return {
    ritualCount: cabinet.ritualCount,
    kept,
    ready: cabinet.available,
  };
}
