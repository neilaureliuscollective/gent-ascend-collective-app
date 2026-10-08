import { z } from 'zod';
export const deliverableFields = z
  .object({
    title: z.string().trim().min(1).max(120),
    body: z.string().trim().min(1).max(50000),
    acceptance: z.string().trim().max(2000),
  })
  .strict();
export const deliverableAction = z.discriminatedUnion('action', [
  z
    .object({ action: z.literal('delete'), id: z.uuid(), expected: z.number().int().positive() })
    .strict(),
  z
    .object({
      action: z.literal('create'),
      missionId: z.uuid(),
      turnId: z.uuid(),
      revision: z.number().int().positive(),
    })
    .strict(),
  deliverableFields
    .extend({
      action: z.literal('save'),
      id: z.uuid(),
      versionId: z.uuid(),
      expected: z.number().int().min(1).max(99),
    })
    .strict(),
  z
    .object({
      action: z.literal('review'),
      id: z.uuid(),
      versionId: z.uuid(),
      note: z.string().trim().min(3).max(2000),
    })
    .strict(),
]);
export type Deliverable = {
  id: string;
  person_id: string;
  mission_id: string | null;
  source_mission_id: string;
  source_turn_id: string | null;
  source_revision: number;
  revision: number;
  created_at: string;
};
export type DeliverableVersion = z.infer<typeof deliverableFields> & {
  id: string;
  person_id: string;
  deliverable_id: string;
  revision: number;
  source: 'reply' | 'manual';
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
};
export function deliverableExport(version: DeliverableVersion) {
  return `# ${version.title}\n\nVersion ${version.revision} · ${version.reviewed_at ? 'Reviewed by you' : 'Draft — not reviewed'}\n\n${version.body}\n\n---\n\n## Acceptance criteria\n${version.acceptance || 'Not recorded.'}\n\n## Review note\n${version.review_note || 'Not reviewed.'}\n\nReview is a user assessment, not independent verification or proof of external execution.\n`;
}
