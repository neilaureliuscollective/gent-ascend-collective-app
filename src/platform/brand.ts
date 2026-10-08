import palette from './visual/aether-palette.json';
/** Public brand identity. Technical IDs and existing persisted keys stay stable. */
export const brand = {
  name: 'Aethelios',
  shortName: 'Aethelios',
  description:
    'Your Personal Intelligence OS. Conversations, decisions, creative work and ongoing Missions in one connected environment.',
  themeColor: palette.obsidian,
  crest: '/brand/aethelios-aether-20261007.webp',
  lockup: '/brand/aethelios-aether-20261007.webp',
  crestAlt:
    'Aethelios gold circular emblem with architectural A, guiding star and laurels on deep Aether Petrol',
} as const;
