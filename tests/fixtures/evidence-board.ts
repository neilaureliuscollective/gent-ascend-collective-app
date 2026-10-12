import { chartSchema } from '@/domains/artifacts/evidence';
// Synthetic evidence packet; this is not provider output or a real company report.
export const packet = {
  text: 'In 2025 Alpha reported 10 USD. In 2025 Beta reported -5 USD. Gamma data was unavailable.',
  sources: [{ id: 's1', url: 'https://example.com/report', title: 'Synthetic report' }],
  retrievedAt: '2026-10-11T00:00:00Z',
};
export const chart = chartSchema.parse({
  kind: 'chart',
  basis: 'research',
  title: 'Synthetic revenue comparison',
  summary: 'Synthetic values for testing only.',
  measure: 'Revenue',
  unit: 'USD',
  period: '2025',
  points: [
    {
      id: 'alpha',
      label: 'Alpha',
      detail: 'Synthetic positive value.',
      value: 10,
      unit: 'USD',
      period: '2025',
      evidence: { basis: 'reported', sourceIds: ['s1'], quote: 'In 2025 Alpha reported 10 USD.' },
    },
    {
      id: 'beta',
      label: 'Beta',
      detail: 'Synthetic negative value.',
      value: -5,
      unit: 'USD',
      period: '2025',
      evidence: { basis: 'reported', sourceIds: ['s1'], quote: 'In 2025 Beta reported -5 USD.' },
    },
    {
      id: 'gamma',
      label: 'Gamma',
      detail: 'Data not found.',
      value: null,
      unit: 'USD',
      period: '2025',
      evidence: { basis: 'unknown', sourceIds: [], quote: '' },
    },
  ],
  limitations: ['Synthetic fixture; do not treat as factual data.'],
  sources: packet.sources,
  retrievedAt: packet.retrievedAt,
});
