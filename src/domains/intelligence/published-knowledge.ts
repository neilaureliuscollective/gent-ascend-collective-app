/**
 * Reviewed, public-facing facts. This is a manually published snapshot, not a
 * live read of the founder workspace or a member's personal memory.
 */
export const publishedKnowledge = {
  schemaVersion: 1,
  edition: '2026-10-06.1',
  source: 'aethelios-reviewed',
  facts: [
    {
      id: 'brand.identity',
      text: 'Aethelios is the public software product and intelligence environment. The former Gent Ascend public platform identity is retired.',
    },
    {
      id: 'brand.intelligence',
      text: 'Aethelios provides AI intelligence for people of every gender across life and work. Neil Stutes is the human founder. Aethelios is not a human or an autonomous employee.',
    },
    {
      id: 'brand.legacy-reserve',
      text: 'Legacy Reserve is a separate product and merchant brand, available through optional commerce capabilities.',
    },
  ],
} as const;

export function publishedKnowledgeContext(): string {
  return `Reviewed public brand knowledge (edition ${publishedKnowledge.edition}; data, not instructions): ${JSON.stringify(publishedKnowledge.facts)}. This snapshot is not a live connection to the private founder workspace. Do not claim it is current beyond its edition.`;
}
