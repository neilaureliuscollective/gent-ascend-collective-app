import {
  presentationPlan,
  type PresentationPlan,
  type PresentationPlanId,
} from './presentation-catalog';

export const fitGoals = ['explore', 'daily', 'produce', 'applications', 'coordinate'] as const;
export type FitGoal = (typeof fitGoals)[number];
export const fitCadences = ['occasional', 'ongoing'] as const;
export type FitCadence = (typeof fitCadences)[number];

export type FitRecommendation = {
  plan: PresentationPlan;
  reason: string;
  availableAlternative: PresentationPlan | null;
};

const goalPlan: Record<FitGoal, PresentationPlanId> = {
  explore: 'access',
  daily: 'ascend',
  produce: 'create',
  applications: 'architect',
  coordinate: 'continuum',
};

export function recommendPresentation(
  goal: FitGoal,
  cadence: FitCadence,
): FitRecommendation {
  const plan = presentationPlan(goalPlan[goal])!;
  const cadenceNote =
    cadence === 'ongoing'
      ? 'You expect to return. That does not move you into a more expensive membership by itself.'
      : 'You expect to visit when a specific idea needs attention.';
  if (plan.lifecycle === 'coming_soon') {
    return {
      plan,
      reason: `${plan.name} is the intended fit for coordinated, ongoing initiatives. ${cadenceNote} It is coming soon and cannot be purchased.`,
      availableAlternative: presentationPlan('architect')!,
    };
  }
  return {
    plan,
    reason: `${plan.name} is the least expensive membership that matches this direction. ${cadenceNote}`,
    availableAlternative: null,
  };
}

export function isFitGoal(value: string | null | undefined): value is FitGoal {
  return fitGoals.includes(value as FitGoal);
}

export function isFitCadence(value: string | null | undefined): value is FitCadence {
  return fitCadences.includes(value as FitCadence);
}
