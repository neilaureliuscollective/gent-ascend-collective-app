import palette from './visual/aether-palette.json';

/** Public brand identity. Technical IDs and existing persisted keys stay stable. */
export const brand = {
  name: 'Aethelios',
  shortName: 'Aethelios',
  description:
    'A personal intelligence OS. Understand, build and continue your work, ideas and ambitions in one considered environment.',
  themeColor: palette.obsidian,
  crest: '/brand/aethelios-human-ascendance-20261015-crest.webp',
  lockup: '/brand/aethelios-human-ascendance-20261015-lockup.webp',
  crestAlt: 'Aethelios gold ascending A, celestial star and Earth',
  lockupAlt:
    'Aethelios — The Human Ascendance. Gold ascending A, celestial star and Earth above the wordmark.',
} as const;
