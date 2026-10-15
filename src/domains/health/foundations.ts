export const healthFoundations = ['evening-routine', 'bloodwork-tracker'] as const;
export type HealthFoundationId = (typeof healthFoundations)[number];

export type HealthFoundation = {
  id: HealthFoundationId;
  title: string;
  intention: string;
  summary: string;
  prompt: string;
};

export const foundationLibrary: HealthFoundation[] = [
  {
    id: 'evening-routine',
    title: 'Evenings, made usable',
    intention: 'A short cooking sequence after work.',
    summary:
      'A structured evening routine with time limits, steps, notes and working timers. Direct editing works without a model.',
    prompt: 'Help me make evenings easier. I finish at six and have twenty minutes to cook.',
  },
  {
    id: 'bloodwork-tracker',
    title: 'Bloodwork Tracker',
    intention: 'Chronological laboratory evidence.',
    summary:
      'Reviewed markers, collection dates, original units and laboratory ranges. Comparisons follow existing compatibility rules.',
    prompt: 'Show my reviewed bloodwork over time, with sources I can inspect.',
  },
];

export function foundationById(id: string) {
  return foundationLibrary.find((item) => item.id === id) ?? null;
}
