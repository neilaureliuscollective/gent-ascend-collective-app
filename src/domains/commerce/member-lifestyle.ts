import type { CollectionEntry } from './collection';
import { cabinetLabels, type CabinetRelation, type CabinetRow } from './cabinet-model';

const chapters = [
  ['grooming', 'Grooming'],
  ['performance', 'Performance'],
  ['recovery', 'Recovery'],
  ['daily-ritual', 'Daily ritual'],
] as const;

export const KEPT_CABINET_RELATIONS = ['owned', 'in_use', 'favorite', 'running_low'] as const;

export const memberLifestylePhotography = [
  {
    id: 'vitalis',
    name: 'Vitalis',
    kind: 'Hair & beard oil',
    src: '/media/world/vitalis-cutout.webp',
    alt: 'Vitalis hair and beard oil bottle in Aethelios packaging',
    href: '/app/collection/vitalis',
    role: 'focal' as const,
  },
  {
    id: 'obsidian-creme',
    name: 'Obsidian Crème',
    kind: 'Face moisturizer',
    src: '/media/world/obsidian-creme-cutout.webp',
    alt: 'Obsidian Crème jar in Aethelios packaging',
    href: '/app/collection',
    role: 'secondary' as const,
  },
  {
    id: 'hydros',
    name: 'Hydros',
    kind: 'Hydration',
    src: '/media/world/hydros-cutout.webp',
    alt: 'Hydros electrolyte tin in Aethelios packaging',
    href: '/app/collection',
    role: 'secondary' as const,
  },
] as const;

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
