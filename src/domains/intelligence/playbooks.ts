import type { CapabilityId } from './capabilities';
import type { SelectedArtifactHint, WorkingState } from './working-state';

export type PlaybookId =
  'vision' | 'architect' | 'ux' | 'brand' | 'studio' | 'lifestyle' | 'health' | 'talk' | 'agency';

export type Playbook = {
  id: PlaybookId;
  purpose: string;
  triggers: string[];
  necessaryContext: string;
  method: string;
  advice: string;
  execute: string;
  quality: string[];
  failures: string[];
  tools: string[];
  permissions: string;
  good: string;
  bad: string;
  definitionOfDone: string;
  approvedSources: string[];
};

export type PlaybookSelectionOptions = {
  recentUserTexts?: readonly string[];
  selectedArtifact?: SelectedArtifactHint | null;
  approvedDirection?: string | null;
  recentCorrections?: readonly string[];
  workingState?: WorkingState | null;
};

export type PlaybookInspection = {
  sourceText: string;
  limit: number;
  selected: PlaybookId[];
  scored: Array<{ id: PlaybookId; score: number; reasons: string[] }>;
};

export const playbooks: Record<PlaybookId, Playbook> = {
  vision: {
    id: 'vision',
    purpose:
      'Develop a product or business concept from a vague idea into a judged direction and practical brief.',
    triggers: [
      'business idea',
      'product concept',
      'membership idea',
      'what if we built',
      'help me shape this idea',
    ],
    necessaryContext:
      'The current request, stated audience if any, constraints, and what is actually built today.',
    method:
      'Infer a useful starting point and label assumptions. Ask only questions that change the result. Offer a few genuinely different directions with tradeoffs, recommend one, and convert the choice into a brief with next step and acceptance test.',
    advice: 'Concept framing, tradeoffs, brief, and a reversible experiment.',
    execute:
      'No company is created, priced, or launched from chat. A brief is a draft until the person saves it.',
    quality: [
      'Assumptions labeled',
      'Distinct directions, not restatements',
      'One recommended path with a concrete next step',
      'Feasibility honest about what is built',
    ],
    failures: [
      'Endless options',
      'Questionnaire instead of a start',
      'Treating planned membership names as checkout',
      'Agreeing with a weak idea to be pleasant',
    ],
    tools: ['Conversation', 'Optional web_search', 'Talk brief/plan offers when those tools exist'],
    permissions: 'Advice is not execution. Agency and Continuum are not implemented products.',
    good: 'Three distinct membership directions, one recommendation, a one-page brief, and the first reversible test.',
    bad: 'A twelve-question intake, or “this will definitely work.”',
    definitionOfDone:
      'The person can act: objective, chosen direction, labeled assumptions, constraints, and next step are explicit.',
    approvedSources: [
      'This conversation',
      'Reviewed published knowledge',
      'User-supplied offer facts',
    ],
  },
  architect: {
    id: 'architect',
    purpose:
      'Turn goals into software, website or application architecture that can actually be built.',
    method:
      'Inspect supplied project facts before proposing a rewrite. Reuse working foundations, name dependencies, preserve approved designs, and define an acceptance test. Separate concept, specification, artifact, implemented change and verified release.',
    triggers: ['architecture', 'website', 'application', 'schema', 'deploy', 'acceptance criteria'],
    necessaryContext:
      'Owner-scoped project/brief, existing routes or components, and capability honesty. No implied repository execution.',
    advice:
      'Requirements, boundaries, dependencies, staged plan, and what would falsify the design.',
    execute:
      'Architect execution, isolated compile, deploy or hosted workers require their own receipts. A route or passing build is not production proof.',
    quality: [
      'Existing components named before new ones',
      'Acceptance test is achievable',
      'Unknown infrastructure stays unknown',
      'Recommendations say what changes, why, and how to test',
    ],
    failures: [
      'Rewrite from scratch without inspecting context',
      '“The app works” because a page exists',
      'Promising Neil will personally build it',
      'Calling a draft deployed',
    ],
    tools: [
      'Conversation drafts',
      'Architect UI when the person opens it',
      'Optional web_search for current APIs',
    ],
    permissions:
      'Do not claim isolated compile, deploy, or hosted worker success without a receipt. Agency is not this environment.',
    good: 'Keep the existing Talk composer; add X to Y; test by Z; remaining uncertainty is the hosted worker.',
    bad: '“Rebuild the platform in a new framework this week.”',
    definitionOfDone:
      'A bounded change list, affected existing components, acceptance test, and explicit unknowns.',
    approvedSources: [
      'Supplied brief',
      'Owner project context',
      'Capability honesty snapshot',
      'Primary API docs when searched',
    ],
  },
  ux: {
    id: 'ux',
    purpose:
      'Improve UX, visual hierarchy and interaction quality with specific, testable craft notes.',
    method:
      'Review the supplied surface or description. Prefer named changes in hierarchy, type, spacing, contrast, motion and accessibility over luxury adjectives. Preserve approved charcoal glass and original assets.',
    triggers: [
      'ux',
      'interaction',
      'usability',
      'accessibility',
      'information architecture',
      'user flow',
    ],
    necessaryContext:
      'The selected artifact, current route, or described composition. Approved visual direction when supplied.',
    advice:
      'Specific visual and interaction changes, including contrast, focus, reduced motion and phone/fold/desktop.',
    execute:
      'Studio/Talk UI edits happen in those surfaces. Chat cannot save a design or ship an interface without a Studio receipt.',
    quality: [
      'Named craft changes (scale, contrast, margin, type size, hit target)',
      'Approved charcoal glass preserved unless the person changes it',
      'Keyboard, focus and reduced-motion considered',
      'Motion stays decorative unless a receipt says otherwise',
    ],
    failures: [
      'Vague premium language',
      'Quietly replacing an approved material',
      'Ignoring phone and fold',
      'Inventing a new logo',
    ],
    tools: [
      'Conversation',
      'Studio editor when the person uses Studio',
      'Selected artifact metadata',
    ],
    permissions: 'A mockup is not a shipped interface. Do not invent replacement brand marks.',
    good: 'Raise title weight, keep charcoal glass, enlarge the primary control to 44px, mute gold to one accent.',
    bad: '“Make it more luxurious and immersive.”',
    definitionOfDone:
      'A short change list a designer or engineer can apply, with what must not change.',
    approvedSources: ['Selected artifact', 'Approved visual direction', 'Existing design tokens'],
  },
  brand: {
    id: 'brand',
    purpose:
      'Brand strategy, creative direction and launch campaigns that stay inside actual capabilities.',
    method:
      'Anchor on the current Aethelios identity and the person’s offer. Develop distinctive directions, then a campaign brief with audience, message, channel and a cheap measurable test. Use the original logo when available.',
    triggers: [
      'brand strategy',
      'creative direction',
      'launch campaign',
      'go to market',
      'positioning',
    ],
    necessaryContext:
      'The offer facts supplied, reviewed brand facts, and capability honesty. Original logo path when supplied.',
    advice: 'Positioning, narrative, campaign architecture, and asset list with provenance.',
    execute:
      'No ads are bought, no email is sent, no Agency workspace is running. Studio/Talk tools only if actually supplied.',
    quality: [
      'Current brand facts over retired Legacy Reserve copy',
      'Original logo used when available; generated images are not exact reproduction',
      'No invented unreleased capabilities',
      'Campaign test is measurable and reversible',
    ],
    failures: [
      'Inventing a replacement crest',
      'Claiming Agency is live',
      'Presenting planned prices as checkout',
      'Launch copy that promises unbuilt features',
    ],
    tools: ['Conversation', 'Talk boards/palettes when available', 'Optional web_search'],
    permissions: 'Agency is not implemented. Do not activate campaigns or spend.',
    good: 'One audience, one promise, three channels, one cheap test, assets listed as supplied or still needed.',
    bad: '“Your Agency is running this week and Continuum checkout is live.”',
    definitionOfDone:
      'A campaign or brand brief the person can review, with honest capability bounds.',
    approvedSources: [
      'Reviewed published knowledge',
      'User-supplied offer',
      'Official crest/lockup when supplied',
    ],
  },
  studio: {
    id: 'studio',
    purpose:
      'Studio workflows, original brand assets and production handoffs with honest readiness labels.',
    method:
      'Review actual outputs when supplied. Distinguish concept, editable document, export and supplier-ready file. Prefer specific craft changes. Preserve approved materials and original artwork.',
    triggers: ['studio', 'mockup', 'export', 'die line', 'production handoff', 'label design'],
    necessaryContext:
      'The selected artifact or described composition. No implied renderer or paid generation.',
    advice:
      'Hierarchy, type, composition, spacing, color, imagery, material, motion, export format and readiness.',
    execute:
      'Hosted rendering and paid generation need their own receipts. Chat cannot freeze, export or commission a worker.',
    quality: [
      'Named craft changes',
      'Exports labeled by actual format and readiness',
      'Original logo not replaced by a generated stand-in',
      'Approved charcoal glass / emerald / gold treatment preserved unless changed',
    ],
    failures: [
      'Luxury adjectives only',
      'Calling a mockup a die line',
      'Claiming an export completed without a job receipt',
    ],
    tools: ['Talk briefs', 'Studio editor/export when the person uses Studio'],
    permissions:
      'Hosted rendering and paid generation need their own receipts. A mockup is not a die line.',
    good: 'Increase title weight, open the left margin, mute the gold until one accent remains, export as review SVG not die line.',
    bad: '“Make it more premium and luxurious” with no craft change.',
    definitionOfDone:
      'A production note that names the file state, remaining craft, and what the person must do in Studio.',
    approvedSources: ['Selected artifact metadata', 'Studio document when supplied'],
  },
  lifestyle: {
    id: 'lifestyle',
    purpose: 'Lifestyle commerce and product storytelling from approved catalog records only.',
    method:
      'Use only supplied catalog records with source IDs and freshness. Ask for a variant when price or stock differs. Keep storytelling bound to approved product_story; never invent efficacy.',
    triggers: ['product', 'catalog', 'ingredient', 'lifestyle', 'in stock', 'the oil'],
    necessaryContext: 'Request-time product snapshot. Cached list is not live stock.',
    advice:
      'Compare relevant products, explain verified use information, and tell the product story from approved copy.',
    execute:
      'Read-only catalog adapter and Lifestyle/shop UI. No Admin, cart mutation or purchase from chat.',
    quality: [
      'Missing ingredients/directions stay unknown',
      'Variant price, id and availability stay bound together',
      'Stale fallback is labeled, never “just verified”',
      'Storytelling does not invent formula or clinical benefit',
    ],
    failures: [
      'Inferring a formula from the name',
      'Pitching products during a health concern',
      'Treating Legacy Reserve as the current brand',
    ],
    tools: [
      'Read-only catalog adapter',
      'Lifestyle/shop UI',
      'Voice lookup_lifestyle_catalog after admission',
    ],
    permissions:
      'No Admin mutations, purchases, or invented efficacy. Supplier label wording is not generated copy.',
    good: 'This 30ml variant is in the approved record at the listed price; ingredients are the metafield text; the 50ml stock is unknown.',
    bad: 'Inferring a formula from the name, or pitching beard oil during a Health question.',
    definitionOfDone:
      'The person knows which product/variant, what is verified, what is unknown, and where to view it.',
    approvedSources: [
      'Shopify Storefront reads',
      'Approved product_story',
      'Merchant ingredients/directions metafields',
    ],
  },
  health: {
    id: 'health',
    purpose:
      'Personal organization and health-information organization within the product’s actual scope.',
    method:
      'In Talk, give bounded information and point to the Health environment for record-backed explanation. Help organize what the person already has. Never mix private health data into business, marketing or commerce context.',
    triggers: ['health record', 'bloodwork', 'symptom', 'dose', 'organize my labs'],
    necessaryContext:
      'Health records exist only on the Health path with consent. Talk does not receive them here.',
    advice:
      'Understandable, evidence-aware information, questions for a qualified professional, and organization next steps.',
    execute:
      'Health ask flow when enabled. Chat cannot diagnose, prescribe, or write Health records.',
    quality: [
      'No diagnosis, prescription, dose or efficacy claim',
      'Uncertainty stays explicit',
      'Emergency mentions get local emergency help, not a diagnosis',
      'Organization help stays inside Health/Talk scope',
    ],
    failures: [
      'A diagnosis',
      'A supplement protocol',
      'Selling a product off a symptom',
      'Mixing Health records into Work',
    ],
    tools: ['Health ask flow when enabled', 'None of Talk’s general memory for Health records'],
    permissions:
      'Do not inject general memory, Lifestyle catalog or company briefs into Health. Do not inject Health records into Talk/Studio/Work.',
    good: 'What the supplied record shows, what it does not, and a question for a qualified professional.',
    bad: 'A diagnosis, a supplement protocol, or selling a product off a symptom.',
    definitionOfDone:
      'The person has a bounded explanation or an organization step, with clinical limits explicit.',
    approvedSources: ['User-reviewed Health records on the Health path only'],
  },
  talk: {
    id: 'talk',
    purpose:
      'Help people explore ideas, clarify what matters, compare options and decide without turning chat into a program.',
    method:
      'Listen for the actual decision. Offer distinct directions during exploration; once a direction is chosen, progress it. Leave room for ordinary conversation.',
    triggers: ['decide', 'compare', 'options', 'explore', 'idea'],
    necessaryContext: 'The current request, this conversation, and opted-in personal context only.',
    advice: 'A useful next move, labeled assumptions, and room for ordinary talk.',
    execute: 'No save, send, generation or activation from a chat claim. Chat is not a write tool.',
    quality: [
      'A useful next move without coaching or project management',
      'Assumptions labeled when used',
      'No invented shared history',
    ],
    failures: ['A questionnaire', 'A pep talk', 'Managing a project the person did not ask to run'],
    tools: ['Text conversation', 'Optional web_search', 'Mission save control in the UI'],
    permissions:
      'No save, send, generation or activation from a chat claim. Chat is not a write tool.',
    good: 'Two real options, the tradeoff, and one reversible next step.',
    bad: 'A questionnaire, a pep talk, or managing a project the person did not ask to run.',
    definitionOfDone:
      'The person can continue: a recommendation or a single material question, not a program.',
    approvedSources: [
      'This conversation',
      'Opted-in profile/memories',
      'Reviewed published knowledge',
    ],
  },
  agency: {
    id: 'agency',
    purpose:
      'Audience, positioning, offer, message, channel, planning and measurable experiments — as advice, not a live Agency product.',
    method:
      'Treat Agency as planned product direction, not an implemented workspace. Use Work/Talk tools that actually exist. Keep campaign advice useful without inventing unreleased capabilities.',
    triggers: ['agency', 'growth experiment', 'channel plan', 'offer copy'],
    necessaryContext: 'The company or offer facts the person supplied. No live ad accounts.',
    advice: 'Experiments that are measurable and reversible.',
    execute:
      'Agency is not implemented. Do not activate campaigns, spend, or pretend a channel is connected.',
    quality: [
      'Experiments are measurable and reversible',
      'No promised revenue',
      'No claim of ongoing execution',
    ],
    failures: [
      '“Your Agency is running this week and will grow revenue.”',
      'Invented ad-account access',
    ],
    tools: ['Work drafts', 'Talk', 'Web search when supplied'],
    permissions:
      'Agency is not implemented. Do not activate campaigns, spend, or pretend a channel is connected.',
    good: 'One audience, one offer hypothesis, one cheap test, and what would stop it.',
    bad: '“Your Agency is running this week and will grow revenue.”',
    definitionOfDone:
      'A bounded experiment the person can run outside a non-existent Agency product.',
    approvedSources: ['User-supplied offer facts', 'Published planned-capability notes'],
  },
};

type Pattern = { id: PlaybookId; pattern: RegExp; reason: string; weight: number };

const patterns: Pattern[] = [
  {
    id: 'lifestyle',
    pattern:
      /\b(product|catalog|ingredient|lifestyle|shop|beard oil|the oil|serum|sku|variant|in stock|efficac)\b/i,
    reason: 'commerce or catalog language',
    weight: 3,
  },
  {
    id: 'health',
    pattern:
      /\b(diagnos\w*|prescrib\w*|bloodwork|lab result|symptom|dose|efficac\w*|clinic|health record)\b/i,
    reason: 'health-information language',
    weight: 3,
  },
  {
    id: 'studio',
    pattern:
      /\b(premium|typography|typeface|layout|composition|mockup|label design|spacing|hierarchy|color|handoff|die line|export)\b/i,
    reason: 'studio craft language',
    weight: 3,
  },
  {
    id: 'ux',
    pattern:
      /\b(ux|usability|interaction|accessibility|hit target|user flow|information architecture|fold|viewport)\b/i,
    reason: 'interaction quality language',
    weight: 3,
  },
  {
    id: 'architect',
    pattern:
      /\b(requirement|acceptance criteria|system boundary|architect|dependency|schema|deploy|website|application development|codebase)\b/i,
    reason: 'software-building language',
    weight: 3,
  },
  {
    id: 'brand',
    pattern:
      /\b(brand strategy|creative direction|launch campaign|go to market|positioning|campaign|branding)\b/i,
    reason: 'brand or launch language',
    weight: 3,
  },
  {
    id: 'agency',
    pattern: /\b(agency workspace|growth experiment|channel plan|offer copy)\b/i,
    reason: 'planned Agency / experiment language',
    weight: 2,
  },
  {
    id: 'vision',
    pattern:
      /\b(business idea|product idea|product concept|membership for|what if we (built|launched)|shape this idea|concept for a)\b/i,
    reason: 'concept-development language',
    weight: 3,
  },
  {
    id: 'talk',
    pattern: /\b(decide|compare|options|directions?|explore|idea)\b/i,
    reason: 'exploration or decision language',
    weight: 2,
  },
];

const SHORT_FOLLOW_UP =
  /^(that one|the second(?: one)?|use that|use the second|yes|ok|okay|continue|the oil|this one)\b/i;

const CAPABILITY_PLAYBOOK: Partial<Record<CapabilityId, PlaybookId>> = {
  lifestyle: 'lifestyle',
  health: 'health',
  studio: 'studio',
  company: 'architect',
};

const TIE_ORDER: PlaybookId[] = [
  'lifestyle',
  'health',
  'studio',
  'architect',
  'brand',
  'ux',
  'vision',
  'talk',
  'agency',
];

function addScore(
  scores: Map<PlaybookId, { score: number; reasons: string[] }>,
  id: PlaybookId,
  amount: number,
  reason: string,
) {
  const current = scores.get(id) ?? { score: 0, reasons: [] };
  current.score += amount;
  if (!current.reasons.includes(reason)) current.reasons.push(reason);
  scores.set(id, current);
}

function scoreText(text: string, scores: Map<PlaybookId, { score: number; reasons: string[] }>) {
  for (const item of patterns) {
    item.pattern.lastIndex = 0;
    if (item.pattern.test(text)) addScore(scores, item.id, item.weight, item.reason);
  }
}

export function inspectPlaybookSelection(
  text: string,
  capability?: CapabilityId | null,
  limit = 2,
  options: PlaybookSelectionOptions = {},
): PlaybookInspection {
  const recent = (options.recentUserTexts ?? []).filter(Boolean);
  const followUp = SHORT_FOLLOW_UP.test(text.trim()) && recent.length > 0;
  const source = followUp
    ? ([...recent].reverse().find((item) => item.trim().length > 12) ?? text)
    : text;
  const scores = new Map<PlaybookId, { score: number; reasons: string[] }>();
  const cap = capability ? CAPABILITY_PLAYBOOK[capability] : undefined;
  if (cap) addScore(scores, cap, 5, `capability ${capability}`);
  scoreText(source, scores);
  if (followUp && text.trim() !== source.trim()) scoreText(text, scores);
  const artifactKind = options.selectedArtifact?.kind?.toLowerCase() ?? '';
  const artifactBlob = [
    options.selectedArtifact?.kind,
    options.selectedArtifact?.title,
    options.selectedArtifact?.prompt,
  ]
    .filter(Boolean)
    .join(' ');
  if (/image|visual|design/.test(artifactKind) || /image|visual|design/.test(artifactBlob)) {
    addScore(scores, 'studio', 2, 'selected visual artifact');
    addScore(scores, 'ux', 1, 'selected visual artifact');
  }
  if (/board|brief|palette/.test(artifactKind) || /board|brief|palette/.test(artifactBlob)) {
    addScore(scores, 'brand', 2, 'selected brand artifact');
    addScore(scores, 'studio', 1, 'selected brand artifact');
  }
  const direction = [
    options.approvedDirection,
    options.workingState?.approvedDirection,
    ...(options.workingState?.constraints ?? []),
  ]
    .filter(Boolean)
    .join(' ');
  if (/charcoal|obsidian|glass|emerald|original logo/i.test(direction)) {
    addScore(scores, 'studio', 2, 'approved visual direction');
    addScore(scores, 'ux', 1, 'approved visual direction');
    addScore(scores, 'brand', 1, 'approved visual direction');
  }
  for (const correction of options.recentCorrections ?? options.workingState?.corrections ?? []) {
    scoreText(correction, scores);
  }
  const scored = [...scores.entries()]
    .map(([id, value]) => ({ id, score: value.score, reasons: value.reasons }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || TIE_ORDER.indexOf(a.id) - TIE_ORDER.indexOf(b.id));
  const selected = scored.slice(0, Math.max(0, limit)).map((item) => item.id);
  return { sourceText: source, limit, selected, scored };
}

export function selectPlaybooks(
  text: string,
  capability?: CapabilityId | null,
  limit = 2,
  options: PlaybookSelectionOptions = {},
): Playbook[] {
  return inspectPlaybookSelection(text, capability, limit, options).selected.map(
    (id) => playbooks[id],
  );
}

export function playbooksForTurn(
  text: string,
  capability?: CapabilityId | null,
  options: PlaybookSelectionOptions = {},
) {
  const playbookSelection = inspectPlaybookSelection(text, capability, 2, options);
  return {
    playbooks: playbookSelection.selected.map((id) => playbooks[id]),
    playbookSelection,
  };
}

function compactPlaybook(playbook: Playbook) {
  return {
    id: playbook.id,
    purpose: playbook.purpose,
    method: playbook.method,
    inputs: playbook.necessaryContext,
    advice: playbook.advice,
    execute: playbook.execute,
    quality: playbook.quality,
    avoid: playbook.failures,
    tools: playbook.tools,
    permissions: playbook.permissions,
    done: playbook.definitionOfDone,
    good: playbook.good,
    bad: playbook.bad,
  };
}

export function playbookContext(
  selected: readonly Playbook[],
  inspection?: PlaybookInspection | null,
) {
  if (!selected.length) return 'No domain playbook was selected for this request.';
  const selection = inspection
    ? ` Inspectable selection: ${JSON.stringify({
        sourceText: inspection.sourceText.slice(0, 180),
        selected: inspection.selected,
        reasons: inspection.scored
          .filter((item) => inspection.selected.includes(item.id))
          .map((item) => ({ id: item.id, score: item.score, reasons: item.reasons })),
      })}.`
    : '';
  return `Relevant domain playbooks (guidance, not extra tools or credentials; at most two): ${JSON.stringify(selected.map(compactPlaybook))}.${selection} Advice is not execution. Do not claim a tool completed work unless this request supplied that tool and a receipt.`;
}
