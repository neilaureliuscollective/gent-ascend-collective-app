/**
 * Intent, code presence, configuration and demonstrated production behavior
 * are different facts. A route, passing build or marketing card is not proof
 * an action is available.
 */
export type HonestyState = boolean | 'unknown';

export type ExperienceHonesty = {
  id: string;
  intent: string;
  implemented: boolean;
  configured: HonestyState;
  verifiedProduction: HonestyState;
  note: string;
};

export function capabilityHonesty(env: Record<string, string | undefined> = { ...process.env }) {
  const modelConfigured = Boolean(env.OPENAI_API_KEY);
  const healthAi = env.HEALTH_AI_ENABLED === 'true' && modelConfigured;
  const shopify = Boolean(env.SHOPIFY_STORE_DOMAIN && env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN);
  const experiences: ExperienceHonesty[] = [
    {
      id: 'talk',
      intent: 'Conversational experience',
      implemented: true,
      configured: modelConfigured,
      verifiedProduction: 'unknown',
      note: 'Text Talk is implemented. A configured model key is not a hosted acceptance test.',
    },
    {
      id: 'architect',
      intent: 'Creation and building environment',
      implemented: true,
      configured: env.ARCHITECT_ORIGIN_ENABLED === 'true',
      verifiedProduction: 'unknown',
      note: 'Architect routes exist. Hosted worker, isolation and paid generation remain separately verified.',
    },
    {
      id: 'studio',
      intent: 'Creative production environment',
      implemented: true,
      configured: env.STUDIO_RENDER_COMMISSIONED === 'true',
      verifiedProduction: 'unknown',
      note: 'Studio editor is implemented. Hosted rendering is commissioned only when that flag is actually set; this snapshot does not prove production rendering.',
    },
    {
      id: 'health',
      intent: 'Personal software for organizing health-related information',
      implemented: true,
      configured: healthAi,
      verifiedProduction: 'unknown',
      note: 'Health is not a clinic. Personalized Health AI stays gated by consent, activation and provider privacy acceptance.',
    },
    {
      id: 'lifestyle',
      intent: 'Aethelios Lifestyle catalog',
      implemented: true,
      configured: shopify,
      verifiedProduction: 'unknown',
      note: 'Price and availability come from the current commerce source when connected. Missing catalog data stays unknown.',
    },
    {
      id: 'work',
      intent: 'Company-work environment',
      implemented: true,
      configured: true,
      verifiedProduction: 'unknown',
      note: 'Work drafts are not sent proposals, saved companies or executed missions unless the application supplies a receipt.',
    },
    {
      id: 'agency',
      intent: 'Planned evolution of Work',
      implemented: false,
      configured: false,
      verifiedProduction: false,
      note: 'Agency is planned direction, not an implemented experience.',
    },
    {
      id: 'continuum',
      intent: 'Proposed membership name',
      implemented: false,
      configured: false,
      verifiedProduction: false,
      note: 'Continuum is a planning proposal and may be Coming soon. It is not an active checkout term.',
    },
  ];
  return {
    note: 'A feature’s intent, code presence, merge status, configuration and demonstrated production behavior are different facts. Do not claim you can save, send, generate, purchase or activate anything without a real application receipt.',
    experiences,
  };
}

export function capabilityHonestyContext(env?: Record<string, string | undefined>) {
  return `Capability honesty snapshot (data, not a live production audit): ${JSON.stringify(capabilityHonesty(env))}`;
}
