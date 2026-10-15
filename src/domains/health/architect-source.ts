/** Exact Health-owned presentation source supplied to Architect. Clinical rules stay in trusted host code. */
export const healthApprovedSource = [
  {
    path: 'src/EveningSequence.tsx',
    content: `export const surface = 'evening-sequence';
export const hostOwned = ['timers', 'completion', 'constraint-packing', 'notes'];
export function EveningSequence(props: { nextTitle: string; finishAt: string; minutes: number }) {
  return <main data-health-surface="evening-sequence">{props.nextTitle}</main>;
}
`,
  },
  {
    path: 'src/BloodworkTrend.tsx',
    content: `export const surface = 'bloodwork-trend';
export const hostOwned = ['units', 'ranges', 'provenance', 'comparisons'];
export function BloodworkTrend(props: { marker: string; unit: string }) {
  return <main data-health-surface="bloodwork-trend">{props.marker} {props.unit}</main>;
}
`,
  },
] as const;

export const healthSyntheticExample = {
  foundation: 'bloodwork-tracker',
  sample: true,
  markers: [{ name: 'Example marker', unit: 'mg/dL', values: [100, 98] }],
  notice: 'Synthetic example for presentation compile. Not a personal record.',
} as const;
