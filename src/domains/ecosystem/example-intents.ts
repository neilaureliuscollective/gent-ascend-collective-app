export const exampleIntentIds = ['brand', 'tool', 'project'] as const;
export type ExampleIntentId = (typeof exampleIntentIds)[number];
export type ExampleSpace = 'talk' | 'studio' | 'architect';

export type ExampleIntent = {
  id: ExampleIntentId;
  label: string;
  invitation: string;
  project: string;
  defaultNote: string;
  brief: string;
  artifacts: readonly { kind: string; title: string; detail: string }[];
  path: readonly { space: ExampleSpace; label: string; action: string }[];
  talkStarter: string;
  studioAvailable: boolean;
  architectAvailable: boolean;
};

export const exampleIntents: readonly ExampleIntent[] = [
  {
    id: 'brand',
    label: 'Create a brand',
    invitation: 'Shape a considered identity before any publication.',
    project: 'Lumen Atelier',
    defaultNote: 'A private editorial house for considered objects.',
    brief:
      'Name, purpose and visual direction for an illustrative brand. Talk holds the brief; Studio can later give it form. This is a labelled example, not a customer result.',
    artifacts: [
      { kind: 'Brief', title: 'Purpose and audience', detail: 'Who it is for, and what it must never become.' },
      { kind: 'Palette', title: 'Obsidian, ivory, reserve gold', detail: 'A restrained material set, not a moodboard dump.' },
      { kind: 'Mark', title: 'Wordmark study', detail: 'Uses the official Aethelios crest only as the host environment.' },
    ],
    path: [
      { space: 'talk', label: 'Talk', action: 'Write the brief and keep decisions.' },
      { space: 'studio', label: 'Studio', action: 'Give the identity a still and a layout.' },
      { space: 'architect', label: 'Architect', action: 'Turn the brief into a working origin project.' },
    ],
    talkStarter: 'ecosystem-brand',
    studioAvailable: true,
    architectAvailable: true,
  },
  {
    id: 'tool',
    label: 'Build a useful tool',
    invitation: 'Define one job a tool should finish cleanly.',
    project: 'Harbor Ledger',
    defaultNote: 'A quiet estimator for materials, time and cost.',
    brief:
      'One bounded tool: inputs, a trustworthy result, and the revision the owner can replay. Architect holds the working preview. This example is not executing in the background.',
    artifacts: [
      { kind: 'Job', title: 'Quantity and cost', detail: 'What must be calculated, and what stays out of scope.' },
      { kind: 'Interface', title: 'Owner inputs', detail: 'A short form, a receipt, no invented automation.' },
      { kind: 'Revision', title: 'Replayable estimate', detail: 'The same inputs return the same result.' },
    ],
    path: [
      { space: 'talk', label: 'Talk', action: 'Name the job and the constraints.' },
      { space: 'architect', label: 'Architect', action: 'Open the existing tool workspace.' },
      { space: 'studio', label: 'Studio', action: 'Optional stills if the tool needs a face.' },
    ],
    talkStarter: 'ecosystem-tool',
    studioAvailable: true,
    architectAvailable: true,
  },
  {
    id: 'project',
    label: 'Organize an ongoing project',
    invitation: 'Keep a living initiative in one place.',
    project: 'Northline Initiative',
    defaultNote: 'A multi-week launch with briefs, stills and next moves.',
    brief:
      'An illustrative ongoing project: current brief, open questions and the next honest move. Continuum is coming soon for coordinated work across Aethelios; today Talk and Work hold the thread.',
    artifacts: [
      { kind: 'Plan', title: 'This week’s moves', detail: 'What is next, what is waiting, what is closed.' },
      { kind: 'Record', title: 'Decisions kept', detail: 'Confirmed notes, not an invented progress feed.' },
      { kind: 'Handoff', title: 'Studio or Architect when needed', detail: 'Leave Talk without losing the brief.' },
    ],
    path: [
      { space: 'talk', label: 'Talk', action: 'Keep the living brief and next move.' },
      { space: 'studio', label: 'Studio', action: 'Produce a still when the project needs one.' },
      { space: 'architect', label: 'Architect', action: 'Open Origin if the project becomes a build.' },
    ],
    talkStarter: 'ecosystem-project',
    studioAvailable: true,
    architectAvailable: true,
  },
];

export const ecosystemTalkStarters: Record<string, string> = {
  'ecosystem-brand':
    'I am developing an illustrative brand called Lumen Atelier: a private editorial house for considered objects. Help me write a brief with purpose, audience and visual direction. Ask only what you need. Do not invent a live customer, a published site or a completed identity.',
  'ecosystem-tool':
    'I want to define a bounded tool called Harbor Ledger: a quiet estimator for materials, time and cost. Help me specify the job, the required inputs and the receipt the owner should see. Do not claim the tool is running or deployed.',
  'ecosystem-project':
    'I am organizing an illustrative ongoing project called Northline Initiative. Help me capture the current brief, open questions and one honest next move. Do not invent progress, a team or a completed launch.',
};

export function exampleIntent(id: string | null | undefined) {
  return exampleIntents.find((intent) => intent.id === id) ?? exampleIntents[0]!;
}

export function isExampleIntentId(value: string | null | undefined): value is ExampleIntentId {
  return exampleIntentIds.includes(value as ExampleIntentId);
}

export function spaceHref(space: ExampleSpace, starter: string) {
  if (space === 'talk') return `/app/aethelios?starter=${encodeURIComponent(starter)}`;
  if (space === 'studio') return '/app/studio';
  return '/app/architect';
}
