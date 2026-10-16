import type { CollectionEntry } from './collection';

export type CatalogStatus = 'ready' | 'empty' | 'unconfigured' | 'error';

export type HousePhotograph = {
  id: string;
  /** Exact Shopify handles this photograph may represent. Never matched by title or filename at runtime. */
  candidateHandles: readonly string[];
  displayName: string;
  kind: string;
  src: string;
  alt: string;
  preferredRole: 'focal' | 'secondary';
  width: number;
  height: number;
};

/**
 * Approved house packshots in this repository. Printed label text is shown as photographed.
 * A photograph becomes a product destination only after a live catalog handle match.
 */
export const approvedHousePhotographs = [
  {
    id: 'vitalis',
    candidateHandles: ['vitalis'],
    displayName: 'Vitalis',
    kind: 'Hair & beard oil',
    src: '/media/world/vitalis-cutout.webp',
    alt: 'Vitalis hair and beard oil bottle in Aethelios packaging',
    preferredRole: 'focal',
    width: 720,
    height: 900,
  },
  {
    id: 'obsidian-creme',
    candidateHandles: ['obsidian-creme'],
    displayName: 'Obsidian Crème',
    kind: 'Face moisturizer',
    src: '/media/world/obsidian-creme-cutout.webp',
    alt: 'Obsidian Crème jar in Aethelios packaging',
    preferredRole: 'secondary',
    width: 360,
    height: 450,
  },
  {
    id: 'obsidian-wash',
    candidateHandles: ['obsidian-wash'],
    displayName: 'Obsidian Wash',
    kind: 'Body wash',
    src: '/media/world/obsidian-wash-cutout.webp',
    alt: 'Obsidian Wash bottle in Aethelios packaging',
    preferredRole: 'secondary',
    width: 360,
    height: 450,
  },
  {
    id: 'hydros',
    candidateHandles: ['hydros'],
    displayName: 'Hydros',
    kind: 'Hydration',
    src: '/media/world/hydros-cutout.webp',
    alt: 'Hydros electrolyte tin in Aethelios packaging',
    preferredRole: 'secondary',
    width: 360,
    height: 450,
  },
  {
    id: 'ascend',
    candidateHandles: ['ascend'],
    displayName: 'Ascend',
    kind: 'Performance',
    src: '/media/world/ascend-cutout.webp',
    alt: 'Ascend performance tin in Aethelios packaging',
    preferredRole: 'secondary',
    width: 360,
    height: 450,
  },
] as const satisfies readonly HousePhotograph[];

export const houseArtFallbackIds = ['vitalis', 'obsidian-creme', 'hydros'] as const;

export type LifestyleSceneSource = 'catalog-house' | 'catalog' | 'house-art';

export type LifestyleSceneItem = {
  id: string;
  name: string;
  kind: string;
  src?: string;
  alt: string;
  width?: number;
  height?: number;
  role: 'focal' | 'secondary';
  href?: string;
  price?: string;
  status?: string;
  size?: string;
  handle?: string;
  orderable?: boolean;
  source: LifestyleSceneSource;
};

export type LifestyleScene = {
  items: LifestyleSceneItem[];
  featuredOrderable: boolean;
};

function houseById(id: string) {
  return approvedHousePhotographs.find((photo) => photo.id === id);
}

function productHref(basePath: string, handle: string) {
  return `${basePath}/${handle}`;
}

function fromCatalog(
  entry: CollectionEntry,
  role: LifestyleSceneItem['role'],
  basePath: string,
  house?: HousePhotograph,
): LifestyleSceneItem {
  return {
    id: house?.id ?? entry.handle,
    name: entry.title,
    kind: entry.size ? `${entry.kind} / ${entry.size}` : entry.kind,
    src: house?.src ?? entry.image?.url,
    alt: house?.alt ?? entry.image?.altText ?? entry.title,
    width: house?.width ?? entry.image?.width ?? undefined,
    height: house?.height ?? entry.image?.height ?? undefined,
    role,
    href: productHref(basePath, entry.handle),
    price: entry.price,
    status: entry.status,
    size: entry.size,
    handle: entry.handle,
    orderable: entry.orderable === true,
    source: house ? 'catalog-house' : 'catalog',
  };
}

function fromHouseArt(
  photo: HousePhotograph,
  role: LifestyleSceneItem['role'],
): LifestyleSceneItem {
  return {
    id: photo.id,
    name: photo.displayName,
    kind: photo.kind,
    src: photo.src,
    alt: photo.alt,
    width: photo.width,
    height: photo.height,
    role,
    source: 'house-art',
  };
}

/** Only a verified published catalog may create product destinations. */
export function resolveLifestyleScene(
  entries: CollectionEntry[],
  options: { basePath: string; status: CatalogStatus },
): LifestyleScene {
  const verified = options.status === 'ready' ? entries.filter((entry) => !entry.preview) : [];
  const used = new Set<string>();
  const matched: LifestyleSceneItem[] = [];

  for (const photo of approvedHousePhotographs) {
    const entry = verified.find((candidate) =>
      (photo.candidateHandles as readonly string[]).includes(candidate.handle),
    );
    if (!entry) continue;
    matched.push(fromCatalog(entry, photo.preferredRole, options.basePath, photo));
    used.add(entry.handle);
  }

  const catalogFill = verified
    .filter((entry) => !used.has(entry.handle))
    .sort((a, b) => Number(Boolean(b.image)) - Number(Boolean(a.image)))
    .map((entry) => fromCatalog(entry, 'secondary', options.basePath));

  const pool = [...matched, ...catalogFill];
  if (!pool.length) {
    const art = houseArtFallbackIds
      .map((id, index) => {
        const photo = houseById(id);
        return photo ? fromHouseArt(photo, index === 0 ? 'focal' : 'secondary') : null;
      })
      .filter((item): item is LifestyleSceneItem => Boolean(item));
    return { items: art, featuredOrderable: false };
  }

  const focal =
    pool.find((item) => item.role === 'focal') ?? pool.find((item) => item.src) ?? pool[0]!;
  const companions = pool
    .filter((item) => item.handle !== focal.handle)
    .slice(0, 2)
    .map((item) => ({ ...item, role: 'secondary' as const }));

  return {
    items: [{ ...focal, role: 'focal' }, ...companions],
    featuredOrderable: focal.orderable === true,
  };
}

export function lifestyleBrowseEntries(
  entries: CollectionEntry[],
  scene: LifestyleScene,
  limit = 6,
) {
  const used = new Set(scene.items.map((item) => item.handle).filter(Boolean));
  return entries.filter((entry) => !used.has(entry.handle)).slice(0, limit);
}

export function lifestyleSceneStatus(status: CatalogStatus, scene: LifestyleScene) {
  if (status === 'error') {
    return 'The collection could not refresh. Current prices and availability could not be verified.';
  }
  if (status === 'unconfigured') {
    return 'Live product availability is not connected yet. Products are not available to order here until the catalog is connected.';
  }
  if (status === 'empty') {
    return 'The collection is being prepared. House photography is shown until published products are available.';
  }
  if (scene.items.some((item) => item.source === 'catalog' || item.source === 'catalog-house')) {
    if (!scene.featuredOrderable) {
      return 'Aethelios Human Ascendance products. The featured piece is in the collection; availability is confirmed on its page.';
    }
    return 'Aethelios Human Ascendance products. Availability is confirmed in the collection.';
  }
  return 'Aethelios Human Ascendance products. Availability is confirmed in the collection.';
}
