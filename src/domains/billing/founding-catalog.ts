/** Commercial offer definitions only. These never grant account permissions. */
export const foundingTiers = ['essential', 'signature', 'reserve'] as const;
export type FoundingTier = (typeof foundingTiers)[number];
export type FoundingPlan = {
  id: FoundingTier;
  name: string;
  monthlyCents: number;
  promise: string;
  foundation: readonly string[];
  planned: readonly string[];
  bundle: string;
};

const foundation = [
  'Your profile, direction and daily actions',
  'Daily check-ins, reflection and progress',
  'Aethelios conversations and confirmed memory',
];

export const foundingPlans: readonly FoundingPlan[] = [
  {
    id: 'essential',
    name: 'Essential',
    monthlyCents: 1999,
    promise: 'A daily foundation. A higher personal standard.',
    foundation,
    planned: [
      'Core personal guidance allowance',
      'Member launch offers on selected products',
      'A focused grooming routine',
    ],
    bundle: 'A focused starter ritual from the founding collection.',
  },
  {
    id: 'signature',
    name: 'Signature',
    monthlyCents: 4999,
    promise: 'A plan that develops with the man.',
    foundation,
    planned: [
      'Everything in Essential',
      'Coordinated weekly plans and suggested adjustments',
      'Included voice and Studio creation allowances',
      'Deeper grooming and performance planning',
    ],
    bundle: 'A fuller grooming ritual, curated around your preferences.',
  },
  {
    id: 'reserve',
    name: 'Reserve',
    monthlyCents: 7499,
    promise: 'Deeper intelligence. A personal relationship.',
    foundation,
    planned: [
      'Everything in Signature',
      'Larger voice and Studio creation allowances',
      'Personal grooming onboarding and quarterly review',
      'Longer-range planning and deeper progress reviews',
    ],
    bundle: 'Our most complete founding selection, personally considered.',
  },
];

export function foundingPlan(tier: string): FoundingPlan | undefined {
  return foundingPlans.find((plan) => plan.id === tier);
}

export function foundingPrice(plan: FoundingPlan) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    plan.monthlyCents / 100,
  );
}
