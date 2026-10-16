export type LiveGlobeEarthState = 'loading' | 'ready' | 'fallback';
export type LiveGlobeEmblemState = 'loading' | 'ready' | 'missing';

export type LiveGlobeAssetState = {
  earth: LiveGlobeEarthState;
  emblem: LiveGlobeEmblemState;
};

export const liveGlobeAssetSources = {
  earth: '/visual/nasa-blue-marble-land-shallow-topo-2048.jpg',
  emblem: '/brand/aethelios-official-20261015-512.png',
  emblemId: 'official-20261015',
} as const;
