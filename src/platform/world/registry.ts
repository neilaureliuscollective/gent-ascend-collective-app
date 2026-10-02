/** Presentation only. Domain services remain the authority for access and records. */
export const worlds = [
  {
    id: 'performance',
    name: 'Performance',
    theme: 'Body & vitality',
    line: 'Strength for the life you carry.',
    detail: 'Training, fuel and recovery. One part of the whole man.',
    href: '/experience/performance',
    image: '/media/world/life-instrument.webp',
    number: '01',
  },
  {
    id: 'grooming',
    name: 'Grooming',
    theme: 'Presence & ritual',
    line: 'Show up with intention.',
    detail: 'Your appearance, routines and professional direction.',
    href: '/experience/grooming',
    image: '/media/world/ritual-mirror-v1.webp',
    number: '02',
  },
  {
    id: 'focus',
    name: 'Direction',
    theme: 'Mind & purpose',
    line: 'Make room for what matters.',
    detail: 'Your priorities, daily practice and reflection.',
    href: '/app/ascend',
    image: '/media/world/sanctuary.webp',
    number: '03',
  },
  {
    id: 'work',
    name: 'Creation',
    theme: 'Work & ideas',
    line: 'Give your ideas a place.',
    detail: 'Projects and visual work in Aethelios Studio.',
    href: '/app/studio',
    image: '/media/world/observatory.webp',
    number: '04',
  },
] as const;
export const worldPaths = {
  threshold: '/experience',
  home: '/experience/world',
  performance: '/experience/performance',
} as const;
