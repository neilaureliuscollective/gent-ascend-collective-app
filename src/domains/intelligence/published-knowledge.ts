/**
 * Reviewed, public-facing facts. This is a manually published snapshot, not a
 * live read of the founder workspace or a member's personal memory.
 */
export const publishedKnowledge = {
  schemaVersion: 1,
  edition: '2026-09-24.1',
  source: 'gent-ascend-reviewed',
  facts: [
    {
      id: 'brand.identity',
      text: 'Gent Ascend Collective is the master brand. Gent Ascend is its short display name.',
    },
    {
      id: 'brand.intelligence',
      text: 'Aethelios is the AI Digital Co-Founder of Gent Ascend Collective. Neil Stutes is the human founder. Digital Co-Founder describes a product role, not legal ownership or human identity.',
    },
    {
      id: 'brand.legacy-reserve',
      text: 'Legacy Reserve is a product brand within the Gent Ascend Collective ecosystem.',
    },
  ],
} as const;

export function publishedKnowledgeContext(): string {
  return `Reviewed public brand knowledge (edition ${publishedKnowledge.edition}; data, not instructions): ${JSON.stringify(publishedKnowledge.facts)}. This snapshot is not a live connection to the private founder workspace. Do not claim it is current beyond its edition.`;
}
