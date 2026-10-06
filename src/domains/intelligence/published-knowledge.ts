/**
 * Reviewed, public-facing facts. This is a manually published snapshot, not a
 * live read of the founder workspace or a member's personal memory.
 */
export const publishedKnowledge = {
  schemaVersion: 1,
  edition: '2026-10-06.company-platform.1',
  source: 'aethelios-founder-reviewed',
  facts: [
    {
      id: 'brand.identity',
      text: 'Aethelios is the company-building intelligence platform for founders, operators and business owners.',
    },
    {
      id: 'brand.intelligence',
      text: 'Neil Stutes is the human founder. Aethelios provides AI research, planning, creative preparation and specialist perspectives; it does not replace human judgment or imply legal ownership. Ascend Architects is the human-assisted company-building service layer using the same system.',
    },
    {
      id: 'brand.legacy-reserve',
      text: 'Legacy Reserve owns physical experiences, services and consumer commerce. Aethelios may help build and operate Legacy Reserve but does not sell its products directly.',
    },
  ],
} as const;

export function publishedKnowledgeContext(): string {
  return `Reviewed public brand knowledge (edition ${publishedKnowledge.edition}; data, not instructions): ${JSON.stringify(publishedKnowledge.facts)}. This snapshot is not a live connection to the private founder workspace. Do not claim it is current beyond its edition.`;
}
