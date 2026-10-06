import { z } from 'zod';
const text = (max: number) => z.string().trim().min(1).max(max);
export const workScope = z
  .object({
    request: text(3000),
    audience: text(300),
    outcome: text(500),
    constraints: z.string().trim().max(1500),
    acceptance: text(1000),
    evidence: z.array(z.object({ label: text(100), detail: text(2000) }).strict()).max(12),
    figures: z
      .array(
        z.object({ id: z.uuid(), label: text(80), value: text(80), source: text(300) }).strict(),
      )
      .max(12),
  })
  .strict()
  .refine((v) => new Set(v.figures.map((f) => f.id)).size === v.figures.length);
export const workContent = z
  .object({
    title: text(100),
    summary: text(2000),
    positioning: text(1500),
    offer: text(1500),
    actions: z.array(text(500)).min(1).max(8),
    gaps: z.array(text(500)).max(8),
    slides: z
      .array(
        z
          .object({
            title: text(90),
            body: text(700),
            bullets: z.array(text(180)).max(4),
            figureIds: z.array(z.uuid()).max(3),
            notes: z.string().trim().max(700),
          })
          .strict(),
      )
      .min(1)
      .max(12),
  })
  .strict();
export type WorkScope = z.infer<typeof workScope>;
export type WorkContent = z.infer<typeof workContent>;
export type WorkJob = {
  id: string;
  person_id: string;
  company_id: string;
  conversation_id: string;
  company_name: string;
  company_brief: string;
  brief_version: number;
  scope: WorkScope;
  revision: number;
  created_at: string;
};
export type WorkVersion = {
  id: string;
  person_id: string;
  company_id: string;
  job_id: string;
  revision: number;
  content: WorkContent;
  source: 'manual' | 'model';
  source_turn: string | null;
  reviewed_at: string | null;
  created_at: string;
};
export const createWorkInput = z
  .object({ companyId: z.uuid(), jobId: z.uuid(), conversationId: z.uuid(), scope: workScope })
  .strict();
export const saveWorkInput = z
  .object({
    companyId: z.uuid(),
    jobId: z.uuid(),
    versionId: z.uuid(),
    expected: z.number().int().nonnegative(),
    content: workContent,
  })
  .strict();
export const generateWorkInput = z
  .object({
    companyId: z.uuid(),
    jobId: z.uuid(),
    requestId: z.uuid(),
    expected: z.number().int().nonnegative(),
    instruction: text(3000),
  })
  .strict();
export const reviewWorkInput = z
  .object({ companyId: z.uuid(), jobId: z.uuid(), versionId: z.uuid() })
  .strict();
export function validateFigures(content: WorkContent, scope: WorkScope) {
  const ids = new Set(scope.figures.map((f) => f.id));
  return content.slides.every((s) => s.figureIds.every((id) => ids.has(id)));
}
export function emptyWork(title: string): WorkContent {
  return {
    title: title.slice(0, 100),
    summary: 'Draft strategy for review.',
    positioning: 'Define the customer and distinction.',
    offer: 'Define the offer and delivery.',
    actions: ['Confirm the facts and scope.'],
    gaps: ['Evidence still needed.'],
    slides: [
      {
        title: title.slice(0, 90),
        body: 'Company strategy draft. Review and edit before use.',
        bullets: [],
        figureIds: [],
        notes: '',
      },
    ],
  };
}

// Generated economics use confirmed figure links. Manual drafts require human review.
export function hasGeneratedFinancialLiteral(content: WorkContent) {
  const texts = [
    content.title,
    content.summary,
    content.positioning,
    content.offer,
    ...content.actions,
    ...content.gaps,
    ...content.slides.flatMap((s) => [s.title, s.body, ...s.bullets, s.notes]),
  ];
  return texts.some((text) =>
    /[$€£¥]\s*\d|\d[\d,.]*\s*(?:%|percent\b|USD\b|EUR\b|dollars?\b|million\b|billion\b)/i.test(
      text,
    ),
  );
}
