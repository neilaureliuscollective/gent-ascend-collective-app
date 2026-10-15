import { isExampleIntentId, type ExampleIntentId } from './example-intents';
import { isPresentationPlanId, type PresentationPlanId } from './presentation-catalog';
import { isFitCadence, isFitGoal, type FitCadence, type FitGoal } from './fit';

export const ecosystemSelectionKey = 'aethelios.ecosystem.selection';

export type EcosystemSelection = {
  intent: ExampleIntentId;
  plan: PresentationPlanId | null;
  note: string;
  goal: FitGoal | null;
  cadence: FitCadence | null;
};

export const emptySelection: EcosystemSelection = {
  intent: 'brand',
  plan: null,
  note: '',
  goal: null,
  cadence: null,
};

export function parseEcosystemSelection(input: {
  intent?: string | null;
  plan?: string | null;
  note?: string | null;
  goal?: string | null;
  cadence?: string | null;
}): EcosystemSelection {
  return {
    intent: isExampleIntentId(input.intent) ? input.intent : 'brand',
    plan: isPresentationPlanId(input.plan) ? input.plan : null,
    note: (input.note ?? '').slice(0, 160),
    goal: isFitGoal(input.goal) ? input.goal : null,
    cadence: isFitCadence(input.cadence) ? input.cadence : null,
  };
}

export function readStoredSelection(): EcosystemSelection | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(ecosystemSelectionKey);
    if (!raw) return null;
    return parseEcosystemSelection(JSON.parse(raw) as EcosystemSelection);
  } catch {
    return null;
  }
}

export function writeStoredSelection(selection: EcosystemSelection) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(ecosystemSelectionKey, JSON.stringify(selection));
}

export function selectionSearch(selection: EcosystemSelection) {
  const params = new URLSearchParams();
  params.set('intent', selection.intent);
  if (selection.plan) params.set('plan', selection.plan);
  if (selection.note) params.set('note', selection.note);
  if (selection.goal) params.set('goal', selection.goal);
  if (selection.cadence) params.set('cadence', selection.cadence);
  return params.toString();
}

export type JourneyGate = {
  signedIn: boolean;
  registrationOpen: boolean;
  claimReady: boolean;
  enrollmentOpen: boolean;
};

export type JourneyAction = {
  href: string | null;
  label: string;
  explanation: string;
  purchase: boolean;
};

export function presentationJourney(
  planId: PresentationPlanId | null,
  gate: JourneyGate,
): JourneyAction {
  if (planId === 'continuum') {
    return {
      href: null,
      label: 'Continuum is coming soon',
      explanation: 'Coming soon never opens payment. You can keep comparing available memberships.',
      purchase: false,
    };
  }
  if (planId === 'access') {
    if (gate.signedIn) {
      return {
        href: '/app',
        label: 'Continue in Aethelios',
        explanation: 'You already have an account. Access is the introductory experience, not a checkout.',
        purchase: false,
      };
    }
    if (gate.claimReady) {
      return {
        href: '/experience/world?claim=1',
        label: 'Begin with a free account',
        explanation: 'Account creation is open. Creating an account does not subscribe or charge you.',
        purchase: false,
      };
    }
    if (gate.registrationOpen) {
      return {
        href: '/join',
        label: 'Create an account',
        explanation: 'Registration is open. Creating an account does not subscribe or charge you.',
        purchase: false,
      };
    }
    return {
      href: '/enter',
      label: 'Sign in if you already have access',
      explanation:
        'Public account registration is not open. Existing invited members can sign in. No checkout is offered.',
      purchase: false,
    };
  }
  if (!planId) {
    return {
      href: '#ecosystem-membership',
      label: 'Compare memberships',
      explanation: 'Choose a direction first. Nothing here starts a subscription.',
      purchase: false,
    };
  }
  if (gate.signedIn) {
    return {
      href: '/app/membership',
      label: 'See your current membership',
      explanation:
        'These preview names are not live products. Your existing founding plan, if any, stays on Your membership.',
      purchase: false,
    };
  }
  return {
    href: '/membership',
    label: 'Review the current founding preview',
    explanation:
      'Paid enrollment for these preview names is not open. Current founding billing still uses Essential, Signature and Reserve.',
    purchase: false,
  };
}
