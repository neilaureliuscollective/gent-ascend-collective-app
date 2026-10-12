import { expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  validateEvidence,
  scenarioValue,
  chartRange,
  publicSourceURL,
} from '@/domains/artifacts/evidence';
import { visualSchema, visualContext } from '@/domains/artifacts/visual';
import { artifactScenario } from '@/domains/artifacts/contract';
import { VisualBoard } from '@/components/live/visual-board';
import { chart, packet } from './fixtures/evidence-board';
it('rejects invented citations, fabricated excerpts and unreported numbers', () => {
  expect(() => validateEvidence(chart, packet)).not.toThrow();
  const changed = structuredClone(chart);
  changed.points[0]!.evidence.sourceIds = ['invented'];
  expect(() => validateEvidence(changed, packet)).toThrow(/citation/);
  const invented = structuredClone(chart);
  invented.points[0]!.evidence.quote = 'In 2025 Alpha reported 100 USD.';
  invented.points[0]!.value = 100;
  expect(() => validateEvidence(invented, packet)).toThrow(/Excerpt/);
  const numeric = structuredClone(chart);
  numeric.points[0]!.value = 999;
  expect(visualSchema.safeParse(numeric).success).toBe(false);
});
it('refuses incompatible units/periods, estimates and missing-value zero filling', () => {
  const changed = structuredClone(chart);
  changed.points[0]!.unit = 'EUR';
  expect(visualSchema.safeParse(changed).success).toBe(false);
  changed.points[0]!.unit = 'USD';
  changed.points[0]!.period = '2024';
  expect(visualSchema.safeParse(changed).success).toBe(false);
  const estimate = structuredClone(chart);
  estimate.points[0]!.evidence.basis = 'inference';
  expect(visualSchema.safeParse(estimate).success).toBe(false);
  const missing = structuredClone(chart);
  missing.points[2]!.value = 0;
  expect(visualSchema.safeParse(missing).success).toBe(false);
});
it('keeps hypothetical changes deterministic, bounded, missing-aware and separate from source values', () => {
  expect(scenarioValue(10, 10)).toBe(11);
  expect(scenarioValue(-5, 10)).toBe(-5.5);
  expect(scenarioValue(null, 10)).toBeNull();
  expect(() => scenarioValue(10, 51)).toThrow();
  expect(() => scenarioValue(10, 1.2)).toThrow();
  expect(chartRange(chart, 10)).toEqual({ min: -5.5, max: 11 });
  expect(chart.points[0]!.value).toBe(10);
  const context = JSON.parse(visualContext({ id: 'owned', visual: chart }, 'alpha', 10));
  expect(context.selectedPart.value).toBe(10);
  expect(context.scenario.selectedValue).toBe(11);
  expect(context.scenario.basis).toBe('hypothetical');
  expect(
    artifactScenario.safeParse({
      conversationId: crypto.randomUUID(),
      artifactId: crypto.randomUUID(),
      scenarioPercent: 51,
    }).success,
  ).toBe(false);
});
it('rejects unsafe or private citation destinations without fetching arbitrary URLs', () => {
  for (const url of [
    'javascript:alert(1)',
    'https://user:pass@example.com',
    'http://127.0.0.1',
    'http://169.254.169.254',
    'http://localhost',
    'http://private.internal',
    'http://[::1]',
    'https://example.com:444/report',
  ])
    expect(publicSourceURL(url)).toBeNull();
  expect(publicSourceURL('https://example.com/report#section')).toBe('https://example.com/report');
});
it('renders a zero-aware signed plot, accessible data and clickable evidence with scenario labels', () => {
  const html = renderToStaticMarkup(
    createElement(VisualBoard, {
      board: visualSchema.parse(chart),
      partId: 'alpha',
      busy: false,
      onSelect: () => {},
      scenarioPercent: 10,
      onScenario: () => {},
    }),
  );
  expect(html).toContain('aria-label="Chart data table"');
  expect(html).toContain('Source-linked AI extraction');
  expect(html).toContain('https://example.com/report');
  expect(html).toContain('Hypothetical 10%');
  expect(html).toContain('Not available');
  expect(html).toContain('live-chart-hypothetical');
  expect(html).not.toContain('width="NaN"');
  expect(html).not.toContain('width="-');
});

it('keeps sourced comparison extraction separate from inference and rejects unsupported reported text', () => {
  const board = {
    kind: 'research-comparison',
    basis: 'research',
    title: 'Synthetic comparison',
    summary: 'Synthetic test only.',
    options: [
      { id: 'alpha', label: 'Alpha', detail: 'Public option.' },
      { id: 'beta', label: 'Beta', detail: 'Public option.' },
    ],
    rows: [
      {
        label: 'Reported revenue',
        cells: [
          {
            optionId: 'alpha',
            value: '10 USD',
            detail: 'Source-linked extraction.',
            evidence: {
              basis: 'reported',
              sourceIds: ['s1'],
              quote: 'In 2025 Alpha reported 10 USD.',
            },
          },
          {
            optionId: 'beta',
            value: 'May require further review',
            detail: 'An inference rather than a reported fact.',
            evidence: { basis: 'inference', sourceIds: [], quote: '' },
          },
        ],
      },
    ],
    limitations: ['Synthetic fixture.'],
    sources: packet.sources,
    retrievedAt: packet.retrievedAt,
  };
  expect(visualSchema.safeParse(board).success).toBe(true);
  const changed = structuredClone(board);
  changed.rows[0]!.cells[0]!.value = '100 USD';
  expect(visualSchema.safeParse(changed).success).toBe(false);
});
