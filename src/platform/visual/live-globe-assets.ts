export type LiveGlobeEarthState = 'loading' | 'ready' | 'fallback';
export type LiveGlobeEmblemState = 'loading' | 'ready' | 'missing';

export type LiveGlobeAssetState = {
  earth: LiveGlobeEarthState;
  emblem: LiveGlobeEmblemState;
};

export const liveGlobeAssetSources = {
  earth: '/visual/nasa-blue-marble-land-shallow-topo-2048.jpg',
  emblem: '/visual/aethelios-original-emblem.png',
  emblemId: 'original-full-logo',
} as const;
