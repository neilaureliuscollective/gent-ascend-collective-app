export type CapabilityId = 'studio' | 'performance' | 'presence' | 'life' | 'company';

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
    description:
      'Creative briefs, visual concepts, projects and image versions. Presentation exports are not yet implemented.',
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
    label: 'Life',
    href: '/app/world',
    description: 'Goals, progress, routines, priorities and broader life context.',
    instruction:
      'Treat this as a Life-context request. Connect the question to the member’s priorities and saved context without turning the answer into a dashboard tour.',
  },
  {
    id: 'company',
    label: 'Company work',
    href: '/app/work',
    description: 'Research, positioning, offers, product development and company economics.',
    instruction:
      'Treat this as company work. Establish the company and outcome, then produce a bounded reviewable brief. Product development is not a shopping request. No company storage, execution or client sharing is implied.',
  },
];

const patterns: Array<[CapabilityId, RegExp]> = [
  [
    'company',
    /\b(company|business|client|positioning|offer|revenue|pricing|economics|margin|sourcing|product development)\b/i,
  ],
  [
    'studio',
    /\b(presentation|deck|slides?|pitch|investor|proposal|campaign|creative|design|image|visual|document|report|brand plan|business plan)\b/i,
  ],
  [
    'performance',
    /\b(workout|training|train|gym|lift|lifting|exercise|strength|cardio|recovery|run|running|fitness|program)\b/i,
  ],
  [
    'presence',
    /\b(groom|grooming|hair|beard|skin|wardrobe|outfit|dress|style|appearance|look|date night|wedding|photo shoot|photoshoot|ready for)\b/i,
  ],
  [
    'life',
    /\b(goal|goals|progress|priority|priorities|routine|week|life|relationship|family|habit|direction|plan my day|today)\b/i,
  ],
];

export function routeCapability(text: string): CapabilityRoute | null {
  const value = text.trim();
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
