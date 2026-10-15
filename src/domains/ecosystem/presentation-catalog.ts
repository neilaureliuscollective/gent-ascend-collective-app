/** Preview membership catalog. Never grants entitlements or maps onto Stripe prices. */
export const presentationPlanIds = [
  'access',
  'ascend',
  'create',
  'architect',
  'continuum',
] as const;
export type PresentationPlanId = (typeof presentationPlanIds)[number];
export type PresentationLifecycle = 'available' | 'preview' | 'coming_soon';

export type PresentationPlan = {
  id: PresentationPlanId;
  name: string;
  monthlyCents: number | null;
  intendedUse: string;
  benefits: readonly string[];
  lifecycle: PresentationLifecycle;
  availability: string;
};

export const presentationPlans: readonly PresentationPlan[] = [
  {
    id: 'access',
    name: 'Access',
    monthlyCents: 0,
    intendedUse: 'Explore Aethelios and begin a bounded introductory experience.',
    benefits: [
      'Enter Talk, Command and the member environments that are already open',
      'Save a personal direction when account creation is available',
      'See how an idea can move through Talk, Studio and Architect',
    ],
    lifecycle: 'available',
    availability: 'Introductory access when account creation is open. It is not a paid plan.',
  },
  {
    id: 'ascend',
    name: 'Ascend',
    monthlyCents: 2900,
    intendedUse: 'Everyday intelligence, personal context and useful daily creation.',
    benefits: [
      'A daily place for conversation, reflection and next moves',
      'Personal context you confirm, not automatic memory',
      'Useful creation inside the current Talk and workspace limits',
    ],
    lifecycle: 'preview',
    availability: 'Selected planning direction. Not a live Stripe product and not purchasable here.',
  },
  {
    id: 'create',
    name: 'Create',
    monthlyCents: 5900,
    intendedUse: 'Greater creative production and reusable project assets.',
    benefits: [
      'Everything Ascend is intended to cover',
      'More room to develop briefs, boards and Studio work',
      'Reusable project assets you keep and reopen',
    ],
    lifecycle: 'preview',
    availability: 'Selected planning direction. Not a live Stripe product and not purchasable here.',
  },
  {
    id: 'architect',
    name: 'Architect',
    monthlyCents: 12900,
    intendedUse: 'Working application and tool creation, with previews and revisions.',
    benefits: [
      'Everything Create is intended to cover',
      'Application and tool work in Architect, including previews and revisions',
      'Greater execution capacity as those workspaces already exist',
    ],
    lifecycle: 'preview',
    availability:
      'Selected planning direction. Architect the workspace is available separately; this membership name is not for sale.',
  },
  {
    id: 'continuum',
    name: 'Continuum',
    monthlyCents: 24900,
    intendedUse: 'Ongoing, coordinated initiatives across Aethelios.',
    benefits: [
      'A place for longer initiatives that span Talk, Studio and Architect',
      'Coordinated progress across more than one project',
      'Continuity for work that does not fit a single session',
    ],
    lifecycle: 'coming_soon',
    availability: 'Coming soon. Not approved for sale and never opens checkout.',
  },
];

export function presentationPlan(id: string | null | undefined) {
  return presentationPlans.find((plan) => plan.id === id);
}

export function presentationPrice(plan: PresentationPlan) {
  if (plan.monthlyCents === null) return 'Price later';
  if (plan.monthlyCents === 0) return 'Free';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    plan.monthlyCents / 100,
  );
}

export function isPresentationPlanId(value: string | null | undefined): value is PresentationPlanId {
  return presentationPlanIds.includes(value as PresentationPlanId);
}

export function canOpenPurchase(plan: PresentationPlan) {
  if (plan.lifecycle === 'coming_soon' || plan.lifecycle === 'preview') return false;
  return false;
}

export const foundingBillingNames = ['Essential', 'Signature', 'Reserve'] as const;
