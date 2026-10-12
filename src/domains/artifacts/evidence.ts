import { z } from 'zod';
const id = z.string().regex(/^[a-z][a-z0-9_-]{0,31}$/);
const title = z.string().trim().min(1).max(100);
const detail = z.string().trim().min(1).max(600);
export function publicSourceURL(value: string) {
  try {
    if (value.length > 2048) return null;
    const url = new URL(value),
      host = url.hostname.toLowerCase();
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.port ||
      !host.includes('.') ||
      /^[\d.]+$/.test(host) ||
      host.includes(':') ||
      host === 'localhost' ||
      /\.(localhost|local|internal|test|invalid)$/.test(host)
    )
      return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}
export const researchSourceSchema = z
  .object({
    id,
    url: z
      .string()
      .max(2048)
      .refine((value) => publicSourceURL(value) !== null),
    title: z.string().min(1).max(160),
  })
  .strict();
export type VisualSource = z.infer<typeof researchSourceSchema>;
export type ResearchPacket = { text: string; sources: VisualSource[]; retrievedAt: string };
export const evidenceSchema = z
  .object({
    basis: z.enum(['reported', 'inference', 'unknown']),
    sourceIds: z.array(id).max(3),
    quote: z.string().max(500),
  })
  .strict();
const draftBase = { title, summary: detail, basis: z.literal('research') };
export const chartDraftSchema = z
  .object({
    ...draftBase,
    kind: z.literal('chart'),
    measure: title,
    unit: z.string().trim().min(1).max(40),
    period: z.string().trim().min(1).max(60),
    points: z
      .array(
        z
          .object({
            id,
            label: title,
            detail,
            value: z.number().min(-1e12).max(1e12).nullable(),
            unit: z.string().trim().min(1).max(40),
            period: z.string().trim().min(1).max(60),
            evidence: evidenceSchema,
          })
          .strict(),
      )
      .min(2)
      .max(12),
    limitations: z.array(title).min(1).max(5),
  })
  .strict();
export const researchComparisonDraftSchema = z
  .object({
    ...draftBase,
    kind: z.literal('research-comparison'),
    options: z
      .array(z.object({ id, label: title, detail }).strict())
      .min(2)
      .max(5),
    rows: z
      .array(
        z
          .object({
            label: title,
            cells: z
              .array(
                z
                  .object({
                    optionId: id,
                    value: z.string().trim().min(1).max(160),
                    detail,
                    evidence: evidenceSchema,
                  })
                  .strict(),
              )
              .min(2)
              .max(5),
          })
          .strict(),
      )
      .min(1)
      .max(8),
    limitations: z.array(title).min(1).max(5),
  })
  .strict();
const saved = {
  sources: z.array(researchSourceSchema).min(1).max(12),
  retrievedAt: z.iso.datetime(),
};
export const chartSchema = chartDraftSchema.extend(saved);
export const researchComparisonSchema = researchComparisonDraftSchema.extend(saved);
export type ResearchBoard = z.infer<typeof chartSchema> | z.infer<typeof researchComparisonSchema>;
const normalized = (value: string) => value.replace(/\s+/g, ' ').trim();
export function validateEvidence(board: ResearchBoard, packet?: ResearchPacket) {
  const sourceIds = new Set(board.sources.map((source) => source.id));
  if (sourceIds.size !== board.sources.length) throw new Error('Duplicate source identity');
  if (
    packet &&
    (JSON.stringify(board.sources) !== JSON.stringify(packet.sources) ||
      board.retrievedAt !== packet.retrievedAt)
  )
    throw new Error('Source catalog mismatch');
  const evidence =
    board.kind === 'chart'
      ? board.points.map((point) => point.evidence)
      : board.rows.flatMap((row) => row.cells.map((cell) => cell.evidence));
  for (const claim of evidence) {
    if (
      new Set(claim.sourceIds).size !== claim.sourceIds.length ||
      claim.sourceIds.some((id) => !sourceIds.has(id))
    )
      throw new Error('Unknown citation');
    if (
      claim.basis === 'reported' &&
      (claim.sourceIds.length === 0 || claim.quote.trim().length < 10)
    )
      throw new Error('Reported claim needs evidence');
    if (claim.basis === 'unknown' && (claim.sourceIds.length > 0 || claim.quote.length > 0))
      throw new Error('Unknown claim cannot assert evidence');
    if (
      claim.quote &&
      (claim.sourceIds.length === 0 ||
        (packet && !normalized(packet.text).includes(normalized(claim.quote))))
    )
      throw new Error('Excerpt not returned by research');
  }
  if (board.kind === 'chart') {
    if (new Set(board.points.map((point) => point.id)).size !== board.points.length)
      throw new Error('Duplicate chart identity');
    if (!board.points.some((point) => point.value !== null))
      throw new Error('No numeric evidence available');
    for (const point of board.points) {
      if (point.unit !== board.unit || point.period !== board.period)
        throw new Error('Incompatible chart units or periods');
      if (point.value === null) {
        if (point.evidence.basis !== 'unknown')
          throw new Error('Missing value must remain unknown');
        continue;
      }
      if (point.evidence.basis !== 'reported')
        throw new Error('Numeric chart values must be reported');
      const numbers = point.evidence.quote.match(/-?\d+(?:,\d{3})*(?:\.\d+)?/g) ?? [];
      if (
        !numbers.some((n) => Number(n.replaceAll(',', '')) === point.value) ||
        !point.evidence.quote.toLowerCase().includes(board.unit.toLowerCase()) ||
        !point.evidence.quote.includes(board.period)
      )
        throw new Error('Chart number, unit or period missing from excerpt');
    }
  } else {
    const ids = board.options.map((option) => option.id);
    if (new Set(ids).size !== ids.length) throw new Error('Duplicate comparison identity');
    for (const row of board.rows) {
      const cells = row.cells.map((cell) => cell.optionId);
      if (
        cells.length !== ids.length ||
        new Set(cells).size !== ids.length ||
        cells.some((value) => !ids.includes(value))
      )
        throw new Error('Comparison cells must match options');
      for (const cell of row.cells)
        if (
          cell.evidence.basis === 'reported' &&
          !normalized(cell.evidence.quote).includes(normalized(cell.value))
        )
          throw new Error('Reported value missing from excerpt');
    }
  }
}
export function scenarioValue(value: number | null, percent: number) {
  if (!Number.isInteger(percent) || percent < -50 || percent > 50)
    throw new Error('Scenario percentage out of range');
  return value === null ? null : value * (1 + percent / 100);
}
export function chartRange(board: z.infer<typeof chartSchema>, percent: number) {
  const values = board.points.flatMap((point) =>
    point.value === null ? [] : [point.value, scenarioValue(point.value, percent)!],
  );
  return { min: Math.min(0, ...values), max: Math.max(0, ...values) };
}
