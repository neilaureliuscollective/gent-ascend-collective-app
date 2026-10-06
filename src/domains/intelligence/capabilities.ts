export type CapabilityId = 'studio' | 'performance' | 'presence' | 'life' | 'collective';

export type CapabilityRoute = {
  id: CapabilityId;
  label: string;
  href: string;
  description: string;
  instruction: string;
};

const routes: CapabilityRoute[] = [
  {
    id: 'studio',
    label: 'Studio',
    href: '/app/studio',
    description: 'Creative briefs, image projects, references and visual outputs.',
    instruction:
      'Treat this as a Studio-capable request. Do the thinking in conversation first, then shape a clear creative brief or next production step. Do not make the member restate the request when they open Studio.',
  },
  {
    id: 'performance',
    label: 'Performance',
    href: '/app/performance',
    description: 'Training, workouts, recovery-aware planning and physical performance.',
    instruction:
      'Treat this as a Performance-capable request. Use available personal context when enabled, distinguish missing signals from negative signals, and produce a practical training direction. Do not force manual tracking unless it materially improves the decision.',
  },
  {
    id: 'presence',
    label: 'Presence',
    href: '/app/presence',
    description: 'Appearance, grooming, wardrobe and readiness for important moments.',
    instruction:
      'Treat this as a Presence-capable request. Optimize how the member shows up for the real moment rather than creating grooming chores. Use saved Presence context only when available and relevant.',
  },
  {
    id: 'life',
    label: 'Ongoing',
    href: '/app/ongoing',
    description: 'Goals, progress, routines, priorities and broader life context.',
    instruction:
      'Treat this as a Life-context request. Connect the question to the member’s priorities and saved context without turning the answer into a dashboard tour.',
  },
  {
    id: 'collective',
    label: 'Products',
    href: '/app/collection',
    description: 'Products, services, membership benefits and physical-world support.',
    instruction:
      'Treat this as a Collective-capable request. Recommend products or services only when they solve the stated need; never make commerce the default answer.',
  },
];

const patterns: Array<[CapabilityId, RegExp]> = [
  ['studio', /\b(presentation|deck|slides?|pitch|investor|proposal|campaign|creative|design|image|visual|document|report|brand plan|business plan)\b/i],
  ['performance', /\b(workout|training|train|gym|lift|lifting|exercise|strength|cardio|recovery|run|running|fitness|program)\b/i],
  ['presence', /\b(groom|grooming|hair|beard|skin|wardrobe|outfit|dress|style|appearance|look|date night|wedding|photo shoot|photoshoot|ready for)\b/i],
  ['collective', /\b(product|products|buy|order|reorder|membership|benefit|supplement|beard oil|shampoo|conditioner|lotion)\b/i],
  ['life', /\b(goal|goals|progress|priority|priorities|routine|week|life|relationship|family|habit|direction|plan my day|today)\b/i],
];

export function routeCapability(text: string): CapabilityRoute | null {
  const value = text.trim();
  // Explicit buying intent takes priority over the appearance noun in that request.
  if (/\b(buy|order|reorder|purchase|checkout)\b/i.test(value)) return routes.find(route => route.id === 'collective') ?? null;
  if (!value) return null;
  for (const [id, pattern] of patterns) {
    if (pattern.test(value)) return routes.find((route) => route.id === id) ?? null;
  }
  return null;
}

export function capabilityContext(text: string) {
  const route = routeCapability(text);
  if (!route) return null;
  return {
    id: route.id,
    label: route.label,
    instruction: route.instruction,
  };
}
