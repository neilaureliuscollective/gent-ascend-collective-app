import palette from './visual/aether-palette.json';
/** Public brand identity. Technical IDs and existing persisted keys stay stable. */
export const brand = {
  name: 'Aethelios',
  shortName: 'Aethelios',
  description:
    'A personal intelligence OS. Understand, build and continue your work, ideas and ambitions in one considered environment.',
  themeColor: palette.ivory,
  crest: '/brand/aethelios-aether-20261007.webp',
  lockup: '/brand/aethelios-aether-20261007.webp',
  crestAlt:
    'Aethelios gold circular emblem with architectural A, guiding star and laurels on deep Aether Petrol',
} as const;
