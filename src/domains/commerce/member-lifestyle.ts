import type { CollectionEntry } from './collection';
import { cabinetLabels, type CabinetRelation, type CabinetRow } from './cabinet-model';

const chapters = [
  ['grooming', 'Grooming'],
  ['performance', 'Performance'],
  ['recovery', 'Recovery'],
  ['daily-ritual', 'Daily ritual'],
] as const;

export const KEPT_CABINET_RELATIONS = ['owned', 'in_use', 'favorite', 'running_low'] as const;

export type MemberCabinetRecord = Pick<CabinetRow, 'id' | 'name' | 'relation' | 'shopify_handle'>;

export type MemberLifestyleCabinet = {
  available: boolean;
  records: MemberCabinetRecord[];
  ritualCount: number;
  keptCount: number;
};

export function memberCatalogDestinations(entries: CollectionEntry[]) {
  const brands = [...new Set(entries.map((entry) => entry.brand).filter(Boolean))].sort();
  return {
    brands,
    chapters: chapters.filter(([id]) => entries.some((entry) => entry.categories.includes(id))),
  };
}

export function memberCabinetPreview(records: MemberCabinetRecord[]) {
  return records.slice(0, 4).map((record) => ({
    ...record,
    label: cabinetLabels[record.relation as CabinetRelation] ?? record.relation,
  }));
}

export function memberGroomingState(cabinet: MemberLifestyleCabinet) {
  return {
    ritualCount: cabinet.ritualCount,
    kept: cabinet.keptCount,
    ready: cabinet.available,
  };
}
