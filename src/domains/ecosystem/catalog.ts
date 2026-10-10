/** Discovery only. Existing server capabilities remain the authorization authority. */
export const ecosystem = [
  {
    id: 'intelligence',
    name: 'Intelligence',
    href: '/app/aethelios',
    status: 'Existing experience',
    description: 'Conversation, read-only research, saved history and explicitly confirmed memory.',
    links: [
      ['Talk', '/app/aethelios'],
      ['Saved Missions', '/app/missions'],
    ],
  },
  {
    id: 'entities',
    name: 'Entities',
    href: '/app/entities',
    status: 'Existing specialists',
    description:
      'Discover the five public specialists already coordinated through Council. Review participation before a model call.',
    links: [['Entity network', '/app/entities']],
  },
  {
    id: 'life',
    name: 'Life',
    href: '/app/life',
    status: 'Existing personal foundation',
    description:
      'Goals, priorities, daily actions, captures and progress. Start with the records you already have.',
    links: [
      ['Your day', '/app/ascend'],
      ['Living Profile foundation', '/app/ascend-profile'],
    ],
  },
  {
    id: 'studio',
    name: 'Studio',
    href: '/app/studio',
    status: 'Provider-dependent',
    description:
      'Creative briefs, private image projects, references and saved revisions. Creation follows existing access and quotas.',
    links: [['Open Studio', '/app/studio']],
  },
  {
    id: 'business',
    name: 'Business & Build',
    href: '/app/work',
    status: 'Company work implemented',
    description:
      'Company rooms, reviewed briefs, research and deliverable versions. Technical guidance is available; repository execution is not.',
    links: [
      ['Company work', '/app/work'],
      ['Technical Entity', '/app/entities#prometheus'],
    ],
  },
  {
    id: 'health',
    name: 'Health',
    href: '/app/health',
    status: 'Educational foundation',
    description:
      'Know More. Live Better. Explore health literacy and a private, temporary appointment-preparation checklist.',
    links: [['Explore Health', '/app/health']],
  },
  {
    id: 'lifestyle',
    name: 'Lifestyle',
    href: '/app/collection',
    status: 'Existing experiences',
    description:
      'Presence, Grooming, Performance and the Collection. Independent brands and commerce retain their boundaries.',
    links: [
      ['Presence', '/app/presence'],
      ['The Collection', '/app/collection'],
      ['Performance', '/app/performance'],
    ],
  },
] as const;
