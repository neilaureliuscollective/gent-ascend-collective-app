import { reviewSchema } from './coworker';
import { z } from 'zod';
import { chartSchema, researchComparisonSchema, validateEvidence, scenarioValue } from './evidence';
const id = z.string().regex(/^[a-z][a-z0-9_-]{0,31}$/);
const title = z.string().trim().min(1).max(100);
const detail = z.string().trim().min(1).max(600);
const base = { title, summary: detail, basis: z.literal('conceptual') };
export const diagramSchema = z
  .object({
    ...base,
    kind: z.literal('diagram'),
    nodes: z
      .array(z.object({ id, label: title, detail }).strict())
      .min(2)
      .max(12),
    edges: z.array(z.object({ from: id, to: id, label: title }).strict()).max(20),
  })
  .strict();
export const comparisonSchema = z
  .object({
    ...base,
    kind: z.literal('comparison'),
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
                  .object({ optionId: id, value: z.string().trim().min(1).max(160), detail })
                  .strict(),
              )
              .min(2)
              .max(5),
          })
          .strict(),
      )
      .min(1)
      .max(8),
  })
  .strict();
export const visualSchema = z
  .discriminatedUnion('kind', [
    diagramSchema,
    comparisonSchema,
    chartSchema,
    researchComparisonSchema,
    reviewSchema,
  ])
  .superRefine((board, ctx) => {
    if (JSON.stringify(board).length > 24000)
      ctx.addIssue({ code: 'custom', message: 'Visual too large' });
    if (board.kind === 'review') return;
    if (board.basis === 'research') {
      try {
        validateEvidence(board);
      } catch (error) {
        ctx.addIssue({
          code: 'custom',
          message: error instanceof Error ? error.message : 'Invalid evidence',
        });
      }
      return;
    }
    const ids = (board.kind === 'diagram' ? board.nodes : board.options).map((item) => item.id);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate visual identity' });
    if (board.kind === 'diagram') {
      const pairs = new Set<string>();
      for (const edge of board.edges) {
        const pair = edge.from + '/' + edge.to;
        if (
          !ids.includes(edge.from) ||
          !ids.includes(edge.to) ||
          edge.from === edge.to ||
          pairs.has(pair)
        )
          ctx.addIssue({ code: 'custom', message: 'Invalid diagram connection' });
        pairs.add(pair);
      }
    } else
      for (const row of board.rows) {
        const cells = row.cells.map((cell) => cell.optionId);
        if (
          cells.length !== ids.length ||
          new Set(cells).size !== ids.length ||
          cells.some((value) => !ids.includes(value))
        )
          ctx.addIssue({
            code: 'custom',
            message: 'Comparison cells must match every option exactly once',
          });
      }
  });
export type VisualBoard = z.infer<typeof visualSchema>;
export function visualPart(board: VisualBoard, partId: string | null | undefined) {
  if (board.kind === 'review') return undefined;
  return (
    board.kind === 'diagram' ? board.nodes : board.kind === 'chart' ? board.points : board.options
  ).find((item) => item.id === partId);
}
export function visualContext(
  artifact: { id: string; visual?: VisualBoard | null },
  partId?: string | null,
  scenarioPercent = 0,
) {
  const board = artifact.visual;
  if (!board) return '';
  if (board.kind === 'review')
    return JSON.stringify({
      artifactId: artifact.id,
      kind: board.kind,
      basis: board.basis,
      coworker: board.coworker,
      summary: board.summary.slice(0, 200),
      suggestion: board.text.slice(0, 1000),
      contextScope: board.contextScope,
      sourceArtifactId: board.sourceArtifactId,
      sourcePartId: board.sourcePartId,
      authority: 'Read-only AI suggestion; no actions executed',
    });
  const part = visualPart(board, partId);
  const point =
    board.kind === 'chart' ? board.points.find((item) => item.id === partId) : undefined;
  const cited = point
    ? point.evidence.sourceIds
    : board.kind === 'research-comparison' && part
      ? board.rows.flatMap(
          (row) => row.cells.find((cell) => cell.optionId === part.id)?.evidence.sourceIds ?? [],
        )
      : null;
  return JSON.stringify({
    artifactId: artifact.id,
    kind: board.kind,
    title: board.title,
    basis: board.basis,
    summary: board.summary.slice(0, 150),
    selectedPart: part
      ? {
          id: part.id,
          label: part.label,
          detail: part.detail.slice(0, 100),
          ...(point
            ? {
                value: point.value,
                unit: point.unit,
                period: point.period,
                evidence: { ...point.evidence, quote: point.evidence.quote.slice(0, 120) },
              }
            : {}),
        }
      : null,
    ...(board.kind === 'chart'
      ? {
          measure: board.measure,
          unit: board.unit,
          period: board.period,
          scenario: {
            basis: 'hypothetical',
            percent: scenarioPercent,
            formula: 'reported value * (1 + percent / 100)',
            selectedValue: point ? scenarioValue(point.value, scenarioPercent) : null,
          },
        }
      : {}),
    ...(board.basis === 'research'
      ? {
          provenance: 'Source-linked AI extraction, not independently verified',
          sources: board.sources
            .filter((source) => cited === null || cited.includes(source.id))
            .slice(0, 3)
            .map((source) => ({ id: source.id, url: source.url.slice(0, 180) })),
        }
      : {}),
    ...((board.kind === 'comparison' || board.kind === 'research-comparison') && part
      ? {
          considerations: board.rows.slice(0, 5).map((row) => ({
            label: row.label.slice(0, 40),
            value: row.cells.find((cell) => cell.optionId === part.id)?.value.slice(0, 60),
          })),
          moreConsiderations: board.rows.length > 5,
        }
      : {}),
  });
}
export function visualSummary(board: VisualBoard) {
  if (board.kind === 'review') return board.title + ' · read-only suggestion\n\n' + board.text;
  return [
    board.title,
    board.basis === 'research'
      ? 'Source-linked AI extraction; review original sources.'
      : 'Conceptual illustration; no external sources retrieved.',
    board.summary,
    ...(board.kind === 'diagram'
      ? board.nodes
      : board.kind === 'chart'
        ? board.points
        : board.options
    ).map((item) => item.label + ': ' + item.detail),
    ...(board.kind === 'comparison' || board.kind === 'research-comparison'
      ? board.rows.map(
          (row) =>
            row.label +
            ': ' +
            row.cells
              .map(
                (cell) =>
                  (board.options.find((option) => option.id === cell.optionId)?.label ??
                    cell.optionId) +
                  ' — ' +
                  cell.value +
                  ' (' +
                  cell.detail +
                  ')',
              )
              .join('; '),
        )
      : []),
    ...(board.kind === 'chart'
      ? board.points.map(
          (point) =>
            point.label +
            ': ' +
            (point.value ?? 'Not available') +
            ' ' +
            point.unit +
            ' (' +
            point.period +
            ')',
        )
      : []),
    ...(board.basis === 'research'
      ? board.sources.map(
          (source) =>
            '[Source ' +
            source.id +
            '](' +
            source.url.replace(
              /[()<>\\]/g,
              (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
            ) +
            ')',
        )
      : []),
  ]
    .join('\n\n')
    .slice(0, 16000);
}
