import type { ProjectContent } from './schema';

export type CreationPath = ProjectContent['discipline'];
export type CreationWorldState = 'arrival' | 'path' | 'shape' | 'direction' | 'plan' | 'work' | 'use' | 'return';
export type CreationFacet = { id: string; title: string; detail: string };
export type CreationQuestion = { id: string; prompt: string; field: 'audience' | 'constraints' | 'outcome' | 'idea' };
export type LabeledExample = { id: string; label: 'example'; title: string; idea: string; note: string };
export type CreationTeach = { what: string; why: string; affects: string; next: string };
export type IllustrativeNode = { id: string; title: string; role: string; detail: string; kind: 'screen' | 'action' | 'result' | 'note' };

export const creationPathProfiles: Record<
  CreationPath,
  {
    title: string;
    detail: string;
    facets: CreationFacet[];
    questions: CreationQuestion[];
    examples: LabeledExample[];
    outputs: string[];
    limit: string;
    teach: CreationTeach;
  }
> = {
  business: {
    title: 'Create a Business',
    detail: 'Customer, offer and delivery — a planning brief, not company incorporation.',
    facets: [
      { id: 'customer', title: 'Customer', detail: 'Who is this for, in their own words.' },
      { id: 'offer', title: 'Offer', detail: 'What they receive first, and what is out of scope.' },
      { id: 'delivery', title: 'Delivery', detail: 'How the first useful result reaches them.' },
    ],
    questions: [
      { id: 'audience', field: 'audience', prompt: 'Who is the first customer you can name without guessing?' },
      { id: 'offer', field: 'constraints', prompt: 'What do they receive first, and what will this brief not incorporate or sell?' },
      { id: 'delivery', field: 'outcome', prompt: 'What first delivery would prove the offer is real?' },
    ],
    examples: [
      {
        id: 'atelier-brief',
        label: 'example',
        title: 'Independent studio retainer',
        idea: 'A planning brief for an independent design studio that sells monthly retainers.',
        note: 'Labelled example. Not a generated alternative and not a live company.',
      },
    ],
    outputs: ['Customer statement', 'Offer boundary', 'First delivery'],
    limit: 'This path does not incorporate a company, open a bank account or file legal documents.',
    teach: {
      what: 'A business path is a customer–offer–delivery brief.',
      why: 'It keeps the idea inspectable before any application or product work starts.',
      affects: 'Changing customer or offer asks you to reconsider delivery. Typed idea text is kept.',
      next: 'Answer one question or skip to save the brief you already have.',
    },
  },
  application: {
    title: 'Design an Application',
    detail: 'Screens, actions and results — software you can review, not an unrestricted build.',
    facets: [
      { id: 'screens', title: 'Screens', detail: 'What someone sees first.' },
      { id: 'actions', title: 'Actions', detail: 'What they can do without leaving the host.' },
      { id: 'results', title: 'Results', detail: 'What is saved and what a first visit should finish.' },
    ],
    questions: [
      { id: 'first-visit', field: 'outcome', prompt: 'What should someone finish on the first visit?' },
      { id: 'audience', field: 'audience', prompt: 'Who is using those screens on day one?' },
      { id: 'constraints', field: 'constraints', prompt: 'Which actions stay out of scope — payments, accounts or publishing?' },
    ],
    examples: [
      {
        id: 'studio-planner',
        label: 'example',
        title: 'Studio planner',
        idea: 'A planning app for independent studios where the first visit creates a project and one milestone.',
        note: 'Labelled example. Not generated application code and not an executable preview.',
      },
    ],
    outputs: ['First-visit result', 'Primary screens', 'Host-persisted records'],
    limit: 'Generated applications persist only through the host. They cannot invent servers, payments or publishing.',
    teach: {
      what: 'An application path is screens, actions and a first-visit result.',
      why: 'Choosing project, milestone or client-review changes the inspectable model before any code is proposed.',
      affects: 'The first-visit choice changes the illustrative model only. It is not generated code and not a compiled preview.',
      next: 'Choose a first-visit result or write your own, then review the plan.',
    },
  },
  product: {
    title: 'Develop a Product',
    detail: 'Use, form and constraints — a concept brief, not physical manufacturing.',
    facets: [
      { id: 'use', title: 'Use', detail: 'The first useful moment in someone’s hands.' },
      { id: 'form', title: 'Form', detail: 'What they hold or see, without inventing a factory.' },
      { id: 'constraints', title: 'Constraints', detail: 'Materials, platforms and non-goals you already know.' },
    ],
    questions: [
      { id: 'use', field: 'outcome', prompt: 'What first use would prove this product is real?' },
      { id: 'audience', field: 'audience', prompt: 'Who uses it first?' },
      { id: 'constraints', field: 'constraints', prompt: 'Which physical, platform or manufacturing steps stay out of this brief?' },
    ],
    examples: [
      {
        id: 'desk-object',
        label: 'example',
        title: 'Desk companion',
        idea: 'A small desk object that keeps one daily ritual visible, without a manufacturing plan.',
        note: 'Labelled example. Not a factory-ready specification.',
      },
    ],
    outputs: ['First use', 'Form notes', 'Explicit non-goals'],
    limit: 'This path does not manufacture, source materials or certify a physical product.',
    teach: {
      what: 'A product path is use, form and known constraints.',
      why: 'It keeps the concept honest before anyone treats it as a build or a factory job.',
      affects: 'Changing use or form asks you to reconsider constraints. The typed idea stays.',
      next: 'Name the first use or skip ahead with the idea you already typed.',
    },
  },
  custom: {
    title: 'Start without limits',
    detail: 'A flexible idea board with concrete starting points — not an unrestricted arbitrary build.',
    facets: [
      { id: 'spark', title: 'Spark', detail: 'The sentence you already have.' },
      { id: 'anchor', title: 'Anchor', detail: 'One concrete starting point you can inspect.' },
      { id: 'edge', title: 'Edge', detail: 'What this exploration will not become today.' },
    ],
    questions: [
      { id: 'anchor', field: 'outcome', prompt: 'What concrete starting point would make this idea inspectable today?' },
      { id: 'audience', field: 'audience', prompt: 'Who is this for, if you already know?' },
      { id: 'edge', field: 'constraints', prompt: 'What will this exploration not attempt today?' },
    ],
    examples: [
      {
        id: 'open-board',
        label: 'example',
        title: 'Open board',
        idea: 'An open exploration that starts with one inspectable note and a single next action.',
        note: 'Labelled example. Open exploration is still bounded by host persistence and review.',
      },
    ],
    outputs: ['Inspectable spark', 'One starting point', 'Named edge'],
    limit: 'Open exploration still cannot invent servers, credentials, payments or publishing.',
    teach: {
      what: 'Open exploration is a flexible board with concrete starting points.',
      why: 'It keeps ambition without pretending every idea is immediately buildable.',
      affects: 'Choosing a starting point shapes the board. It does not silently start a build.',
      next: 'Pick a starting point or keep writing freely, then save the brief.',
    },
  },
};

export const applicationFirstVisit = [
  {
    id: 'project',
    title: 'Create a project',
    detail: 'Set up a project with key details and a next step.',
    nodes: ['overview', 'project'],
  },
  {
    id: 'client',
    title: 'Invite a client',
    detail: 'Add a client and send an invitation.',
    nodes: ['overview', 'client'],
  },
  {
    id: 'milestone',
    title: 'Plan a milestone',
    detail: 'Add the first milestone to a project.',
    nodes: ['overview', 'project', 'milestone'],
  },
] as const;

export function creationPathProfile(path: CreationPath) {
  return creationPathProfiles[path];
}

export function pathSwitchNote(from: CreationPath, to: CreationPath, idea: string) {
  const kept = idea.trim() ? 'Your typed idea is kept.' : 'No idea text was entered yet.';
  if (from === to) return kept;
  return `${kept} ${creationPathProfiles[from].title} decisions for ${creationPathProfiles[from].facets
    .map((facet) => facet.title.toLowerCase())
    .join(', ')} need reconsideration on ${creationPathProfiles[to].title}.`;
}

export function labeledDirectionOptions(path: CreationPath) {
  return creationPathProfiles[path].examples.map((example) => ({
    id: example.id,
    title: example.title,
    summary: example.idea,
    tradeoff: example.note,
    label: 'example' as const,
  }));
}

export function illustrativeApplicationModel(input: {
  idea: string;
  firstVisit?: string;
  audience?: string;
}): { kind: 'illustrative'; label: string; nodes: IllustrativeNode[] } {
  const visit = applicationFirstVisit.find((row) => row.id === input.firstVisit) ?? applicationFirstVisit[0];
  const nodes: IllustrativeNode[] = [
    {
      id: 'overview',
      title: 'Overview',
      role: 'screen',
      kind: 'screen',
      detail: input.idea.trim() || 'Waiting for your words. This is an illustrative model, not generated code.',
    },
    {
      id: 'project',
      title: 'Project',
      role: 'action',
      kind: 'action',
      detail: visit.id === 'client' ? 'Project setup stays available after a client is named.' : 'Set up a project with a name and next step.',
    },
    {
      id: 'milestone',
      title: 'Milestone',
      role: 'result',
      kind: 'result',
      detail:
        visit.id === 'milestone'
          ? 'The first visit should finish one milestone. This is not an executable preview.'
          : 'Milestones stay optional until you choose that first-visit result.',
    },
  ];
  if (visit.id === 'client') {
    nodes.splice(2, 0, {
      id: 'client',
      title: 'Client',
      role: 'action',
      kind: 'action',
      detail: 'Add a client record. Invitation sending is a planned host action, not a live mailer.',
    });
  }
  if (input.audience?.trim()) {
    nodes[0] = {
      ...nodes[0]!,
      detail: `${nodes[0]!.detail} Audience: ${input.audience.trim()}`,
    };
  }
  return {
    kind: 'illustrative',
    label: 'Illustrative model — not generated code and not a compiled preview.',
    nodes,
  };
}

export const FIRST_VISIT_IDS = ['project', 'client', 'milestone'] as const;
export type FirstVisitId = (typeof FIRST_VISIT_IDS)[number];

export type CreationBrief = {
  path: CreationPath;
  firstVisit?: FirstVisitId;
  audience: string;
  constraints: string;
  outcome: string;
  idea: string;
};

const CREATION_DECISION = /^creation\.v1(?:\s+firstVisit=(project|client|milestone))?(?:\s|$)/m;

export function encodeCreationDecision(firstVisit?: string) {
  const visit = FIRST_VISIT_IDS.find((id) => id === firstVisit);
  return visit ? `creation.v1 firstVisit=${visit}` : 'creation.v1';
}

export function readFirstVisit(decisions: string): FirstVisitId | undefined {
  const match = decisions.match(CREATION_DECISION);
  return match?.[1] as FirstVisitId | undefined;
}

export function mergeCreationDecision(existing: string, firstVisit?: string) {
  const line = encodeCreationDecision(firstVisit);
  const rest = existing.replace(/^creation\.v1[^\n]*\n?/, '').trim();
  return rest ? `${line}\n${rest}` : line;
}

export function readCreationBrief(content: {
  discipline?: CreationPath;
  description?: string;
  blueprint?: Partial<ProjectContent['blueprint']>;
}): CreationBrief {
  return {
    path: content.discipline ?? 'custom',
    firstVisit: readFirstVisit(content.blueprint?.decisions ?? ''),
    audience: content.blueprint?.audience ?? '',
    constraints: content.blueprint?.requirements ?? '',
    outcome: content.blueprint?.next ?? '',
    idea: content.blueprint?.vision || content.description || '',
  };
}

export function creationBriefForGeneration(content: {
  discipline?: CreationPath;
  description?: string;
  blueprint?: Partial<ProjectContent['blueprint']>;
}) {
  const brief = readCreationBrief(content);
  return [
    brief.idea,
    `Path: ${brief.path}`,
    brief.firstVisit ? `First visit: ${brief.firstVisit}` : '',
    brief.audience.trim() ? `Audience: ${brief.audience.trim()}` : '',
    brief.constraints.trim() ? `Constraints: ${brief.constraints.trim()}` : '',
    brief.outcome.trim() ? `Outcome: ${brief.outcome.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function applicationPlan(input: {
  idea: string;
  firstVisit?: string;
  audience?: string;
  constraints?: string;
  outcome?: string;
  path?: CreationPath;
  collections?: string[];
}) {
  const visit = applicationFirstVisit.find((row) => row.id === input.firstVisit);
  const idea = input.idea.trim() || 'No idea yet.';
  const unsupported = [
    ...(input.constraints?.match(/payment|publish|server|account/i) ? ['Payments, accounts, servers and publishing stay out of generated applications.'] : []),
  ];
  if (visit?.id === 'client') {
    return {
      screens: ['Overview', 'Clients', 'Invitation'],
      actions: ['Add a client', 'Send an invitation'],
      data: input.collections?.length ? input.collections : ['clients', 'projects'],
      relationships: 'A client can be named before a project exists. Invitation sending is a planned host action, not a live mailer.',
      idea,
      audience: input.audience?.trim() || '',
      firstVisit: visit.id,
      unsupported,
      label: 'Plan from your brief and first-visit choice. Technical files stay available on demand.',
    };
  }
  if (visit?.id === 'milestone') {
    return {
      screens: ['Overview', 'Projects', 'Milestones'],
      actions: ['Create a project', 'Add the first milestone'],
      data: input.collections?.length ? input.collections : ['projects', 'milestones'],
      relationships: 'A project holds milestones. Changing a milestone does not silently restore an older revision.',
      idea,
      audience: input.audience?.trim() || '',
      firstVisit: visit.id,
      unsupported,
      label: 'Plan from your brief and first-visit choice. Technical files stay available on demand.',
    };
  }
  return {
    screens: ['Overview', 'Projects'],
    actions: ['Create a project'],
    data: input.collections?.length ? input.collections : ['projects'],
    relationships: 'A project is the saved record. Preview and execution stay separate from this plan.',
    idea,
    audience: input.audience?.trim() || '',
    firstVisit: visit?.id ?? 'project',
    unsupported,
    label: 'Plan from your brief and first-visit choice. Technical files stay available on demand.',
  };
}

export type InspectTarget = {
  id: string;
  kind: 'file' | 'record' | 'plan' | 'unsupported';
  title: string;
  detail: string;
  evidence: string;
  path?: string;
  collection?: string;
};

export function inspectTargets(input: {
  files: { path: string; content: string }[];
  records: Record<string, Record<string, unknown>[]>;
  plan: ReturnType<typeof applicationPlan>;
  revision?: number;
}): InspectTarget[] {
  const files = input.files.map((file) => ({
    id: `file:${file.path}`,
    kind: 'file' as const,
    title: file.path,
    path: file.path,
    detail: `Saved generated file for revision ${input.revision ?? 'unknown'}.`,
    evidence: file.content.slice(0, 280) || 'The saved file is empty.',
  }));
  const records = Object.entries(input.records).flatMap(([collection, rows]) =>
    rows.map((row) => ({
      id: `record:${collection}:${String(row.id ?? row.title)}`,
      kind: 'record' as const,
      title: String(row.title ?? row.id ?? collection),
      collection,
      detail: `Host record in ${collection}. Records persist independently of the preview session.`,
      evidence: JSON.stringify(row).slice(0, 280),
    })),
  );
  const plan = input.plan.screens.map((screen) => ({
    id: `plan:${screen}`,
    kind: 'plan' as const,
    title: screen,
    detail: `Planned screen from the persisted brief${input.plan.firstVisit ? ` and first-visit ${input.plan.firstVisit}` : ''}.`,
    evidence: `${input.plan.relationships} Actions: ${input.plan.actions.join(', ')}.`,
  }));
  const targets = [...files, ...records, ...plan];
  if (!targets.length) {
    return [
      {
        id: 'unsupported:none',
        kind: 'unsupported',
        title: 'No mapped target',
        detail: 'This preview does not expose a painted inspector. Use host Files, Records or Plan.',
        evidence: 'Appearance alone is not evidence of behavior.',
      },
    ];
  }
  return targets;
}

export function explainInspectTarget(target: InspectTarget) {
  if (target.kind === 'unsupported') return `${target.detail} ${target.evidence}`;
  if (target.kind === 'file')
    return `${target.path} is a saved generated file for this revision. Host evidence, not a filename guess: ${target.evidence}`;
  if (target.kind === 'record')
    return `${target.title} is a host ${target.collection} record that survives the preview session. Evidence: ${target.evidence}`;
  return `${target.title}: ${target.detail} ${target.evidence}`;
}

export function changeScopeForTarget(target: InspectTarget, revision?: number) {
  const scope = target.path ?? target.collection ?? target.title;
  return `Change ${scope} in revision ${revision ?? 'current'} without overwriting the working revision. Keep the last working preview available until this proposal is reviewed and accepted.`;
}

export function inspectScopeForFiles(files: { path: string; content: string }[]) {
  return files.some(
    (file) =>
      file.content.includes('architect-apps-inspect/v1') && file.content.includes('data-architect-target'),
  )
    ? 'elements'
    : 'host';
}

export function acceptInspectMessage(
  data: unknown,
  bound: { session: string; projectId: string; revisionId: string },
  knownIds: string[],
  seenNonces?: Set<string>,
) {
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;
  if (row.schema !== 'architect-apps-inspect/v1') return null;
  if (typeof row.session !== 'string' || row.session !== bound.session) return null;
  if (row.projectId && row.projectId !== bound.projectId) return null;
  if (row.revisionId && row.revisionId !== bound.revisionId) return null;
  if (typeof row.targetId !== 'string' || !knownIds.includes(row.targetId)) return null;
  if (row.source === 'preview') {
    if (typeof row.nonce !== 'string' || row.nonce.length < 8) return null;
    if (seenNonces?.has(row.nonce)) return null;
    seenNonces?.add(row.nonce);
  }
  return row.targetId;
}

export function revisionKind(input: {
  status?: string;
  working?: boolean;
  current?: boolean;
  selected?: boolean;
  proposed?: boolean;
  failed?: boolean;
}) {
  if (input.proposed) return 'proposed';
  if (input.failed || input.status === 'failed') return 'failed';
  if (input.current) return 'current';
  if (input.working) return 'previous';
  if (input.selected) return 'selected';
  return input.status || 'saved';
}

export function teachFor(path: CreationPath, facet?: string): CreationTeach {
  const profile = creationPathProfiles[path];
  const match = profile.facets.find((row) => row.id === facet);
  if (!match) return profile.teach;
  return {
    what: `${match.title}: ${match.detail}`,
    why: profile.teach.why,
    affects: profile.teach.affects,
    next: profile.teach.next,
  };
}
