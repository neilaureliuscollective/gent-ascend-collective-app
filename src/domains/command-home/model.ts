export const commandSources = ['architect', 'studio', 'company', 'talk'] as const;
export type CommandSource = (typeof commandSources)[number];

export type CommandFocus =
  | { source: 'architect'; id: string }
  | { source: 'studio'; id: string }
  | { source: 'company'; companyId: string; id: string }
  | { source: 'talk'; id: string };

export type ArtifactKind = 'document' | 'image' | 'slide' | 'summary' | 'conversation' | 'none';

export type AttentionKind = 'continue-draft' | 'review-result' | 'missing-input' | 'running-job';

export type CommandItem = {
  key: string;
  source: CommandSource;
  id: string;
  companyId?: string;
  conversationId?: string;
  title: string;
  detail: string;
  updatedAt: string;
  status: string;
  href: string;
  resumeHref: string;
  resumeLimitation?: string;
};

export type CommandArtifact = {
  kind: ArtifactKind;
  title: string;
  excerpt: string;
  imageHref: string | null;
  htmlPreview: string | null;
  fallback: string;
  provenance: string;
};

export type AttentionItem = {
  id: string;
  kind: AttentionKind;
  kindLabel: string;
  title: string;
  detail: string;
  source: string;
  state: string;
  href: string;
};

export type SourceAvailability = {
  id: 'architect' | 'studio' | 'work' | 'talk';
  state: 'ready' | 'awaiting' | 'unavailable' | 'closed';
  message?: string;
};

export type CommandHomeData = {
  ownerId: string;
  founderOffice: boolean;
  asOf: string;
  orientation: { line: string; freshness: string | null };
  items: CommandItem[];
  selectedKey: string | null;
  selected: CommandItem | null;
  artifact: CommandArtifact;
  attention: AttentionItem[];
  sources: SourceAvailability[];
  recentConversation: { id: string; title: string } | null;
};

export type ArchitectRecord = {
  id: string;
  name: string;
  description: string;
  status: string;
  updatedAt: string;
  documents: { id: string; title: string; kind: string; content: string; status: string }[];
  blueprintExcerpt?: string;
  running?: boolean;
};

export type CompanyRecord = { id: string; name: string };

export type JobRecord = {
  id: string;
  companyId: string;
  conversationId: string | null;
  createdAt: string;
  request: string;
};

export type WorkVersionRecord = {
  jobId: string;
  revision: number;
  title: string;
  summary: string;
  gaps: string[];
  slides: { title: string; body: string }[];
  reviewedAt: string | null;
  createdAt: string;
};

export type StudioProjectRecord = { id: string; title: string; updatedAt: string };

export type StudioVersionRecord = {
  id: string;
  projectId: string;
  status: string;
  prompt: string;
  createdAt: string;
};

export type TalkRecord = { id: string; title: string; updatedAt: string };

export type CommandHomeRecords = {
  ownerId: string;
  founderOffice: boolean;
  asOf: string;
  architect: { availability: SourceAvailability; projects: ArchitectRecord[] };
  companies: CompanyRecord[];
  jobs: JobRecord[];
  versions: WorkVersionRecord[];
  studio: {
    availability: SourceAvailability;
    projects: StudioProjectRecord[];
    versions: StudioVersionRecord[];
  };
  conversations: TalkRecord[];
  workAvailability: SourceAvailability;
  talkAvailability: SourceAvailability;
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const FOCUS_PARAM = 'focus';

export function isUuid(value: string | null | undefined): value is string {
  return !!value && UUID.test(value);
}

export function itemKey(item: Pick<CommandItem, 'source' | 'id' | 'companyId'>): string {
  return item.source === 'company' && item.companyId
    ? `company:${item.companyId}:${item.id}`
    : `${item.source}:${item.id}`;
}

export function serializeFocus(focus: CommandFocus): string {
  return focus.source === 'company' ? `company:${focus.companyId}:${focus.id}` : `${focus.source}:${focus.id}`;
}

export function parseFocus(value: string | null | undefined): CommandFocus | null {
  if (!value) return null;
  const [source, first, second] = value.split(':');
  if (source === 'company' && isUuid(first) && isUuid(second))
    return { source: 'company', companyId: first, id: second };
  if (
    (source === 'architect' || source === 'studio' || source === 'talk') &&
    isUuid(first) &&
    !second
  )
    return { source, id: first };
  return null;
}

export function keysMatch(item: CommandItem, focus: CommandFocus | null): boolean {
  if (!focus) return false;
  if (item.source !== focus.source || item.id !== focus.id) return false;
  return focus.source !== 'company' || item.companyId === focus.companyId;
}

/** Keep the chosen item even when a newer project arrives. Ignore foreign/stale keys. */
export function resolveSelectedKey(
  items: CommandItem[],
  requested?: string | null,
  previousKey?: string | null,
): string | null {
  if (!items.length) return null;
  const requestedFocus = parseFocus(requested);
  const requestedItem = requestedFocus && items.find((item) => keysMatch(item, requestedFocus));
  if (requestedItem) return requestedItem.key;
  if (previousKey && items.some((item) => item.key === previousKey)) return previousKey;
  return [...items].sort(compareRecency)[0]!.key;
}

export function compareRecency(a: CommandItem, b: CommandItem): number {
  const delta = Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  return delta !== 0 ? delta : a.key.localeCompare(b.key);
}

export function relativeFreshness(iso: string | null | undefined, asOf: string): string | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  const now = Date.parse(asOf);
  if (!Number.isFinite(then) || !Number.isFinite(now) || now < then) return null;
  const minutes = Math.floor((now - then) / 60000);
  if (minutes < 1) return 'Updated just now';
  if (minutes < 60) return `Updated ${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `Updated ${days} day${days === 1 ? '' : 's'} ago`;
  return `Updated ${new Date(then).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

export function buildOrientation(
  items: CommandItem[],
  selected: CommandItem | null,
  asOf: string,
): CommandHomeData['orientation'] {
  if (!items.length) {
    return {
      line: 'Nothing saved yet. Start a project, open Work, or think with Aethelios.',
      freshness: null,
    };
  }
  const latest = [...items].sort(compareRecency)[0]!;
  const freshness = relativeFreshness(latest.updatedAt, asOf);
  if (items.length === 1) {
    return {
      line: `${latest.title} is present from ${sourceLabel(latest.source)}.`,
      freshness,
    };
  }
  return {
    line: `${items.length} saved pieces of work. ${selected ? `${selected.title} is in focus.` : `${latest.title} was touched last.`}`,
    freshness,
  };
}

export function sourceLabel(source: CommandSource): string {
  return source === 'architect'
    ? 'Architect'
    : source === 'studio'
      ? 'Studio'
      : source === 'company'
        ? 'Work'
        : 'Talk';
}

export function attentionKindLabel(kind: AttentionKind): string {
  return kind === 'continue-draft'
    ? 'Continue draft'
    : kind === 'review-result'
      ? 'Review suggestion'
      : kind === 'missing-input'
        ? 'Missing input'
        : 'Running job';
}

export function collectItems(records: CommandHomeRecords): CommandItem[] {
  const companies = new Map(records.companies.map((company) => [company.id, company]));
  const latestVersion = latestVersions(records.versions);
  const architect = records.architect.projects.map((project) => ({
    key: `architect:${project.id}`,
    source: 'architect' as const,
    id: project.id,
    title: project.name || 'Untitled project',
    detail: project.description.trim() || 'Architect project',
    updatedAt: project.updatedAt,
    status: project.status,
    href: `/app/architect?project=${project.id}`,
    resumeHref: `/app/architect?project=${project.id}`,
    resumeLimitation:
      'Architect restores the saved project. Exact canvas scroll and unsaved draft panels stay on the Architect route.',
  }));
  const work = records.jobs.flatMap((job) => {
    const company = companies.get(job.companyId);
    if (!company) return [];
    const version = latestVersion.get(job.id);
    return [
      {
        key: `company:${job.companyId}:${job.id}`,
        source: 'company' as const,
        id: job.id,
        companyId: job.companyId,
        conversationId: job.conversationId ?? undefined,
        title: version?.title || clip(job.request, 80) || 'Company job',
        detail: `${company.name}${version?.summary ? ` · ${clip(version.summary, 120)}` : ''}`,
        updatedAt: version?.createdAt ?? job.createdAt,
        status: version ? (version.reviewedAt ? 'reviewed' : 'unreviewed') : 'saved',
        href: `/app/companies/${job.companyId}/work/${job.id}`,
        resumeHref: `/app/companies/${job.companyId}/work/${job.id}`,
      },
    ];
  });
  const studio = records.studio.projects.map((project) => ({
    key: `studio:${project.id}`,
    source: 'studio' as const,
    id: project.id,
    title: project.title || 'Studio project',
    detail: 'Studio project',
    updatedAt: project.updatedAt,
    status: 'saved',
    href: `/app/studio?project=${project.id}`,
    resumeHref: `/app/studio?project=${project.id}`,
  }));
  const talk = records.conversations.map((conversation) => ({
    key: `talk:${conversation.id}`,
    source: 'talk' as const,
    id: conversation.id,
    conversationId: conversation.id,
    title: conversation.title || 'Conversation',
    detail: 'Saved Talk',
    updatedAt: conversation.updatedAt,
    status: 'saved',
    href: `/app/aethelios?conversation=${conversation.id}`,
    resumeHref: `/app/aethelios?conversation=${conversation.id}`,
  }));
  return [...architect, ...work, ...studio, ...talk].sort(compareRecency);
}

export function buildArtifact(
  selected: CommandItem | null,
  records: CommandHomeRecords,
): CommandArtifact {
  if (!selected) {
    return {
      kind: 'none',
      title: 'No saved work in focus',
      excerpt: '',
      imageHref: null,
      htmlPreview: null,
      fallback: 'Create or select a project to see a saved artifact here.',
      provenance: 'No authorized preview',
    };
  }
  if (selected.source === 'architect') {
    const project = records.architect.projects.find((item) => item.id === selected.id);
    const document = project?.documents.find((item) => item.content.trim()) ?? project?.documents[0];
    const excerpt =
      document?.content.trim() ||
      project?.blueprintExcerpt?.trim() ||
      project?.description.trim() ||
      '';
    return {
      kind: document ? 'document' : excerpt ? 'summary' : 'none',
      title: document?.title || selected.title,
      excerpt: clip(excerpt, 900),
      imageHref: null,
      htmlPreview: document && looksLikeHtml(document.content) ? document.content : null,
      fallback: excerpt
        ? ''
        : 'This Architect project has no saved document excerpt yet.',
      provenance: document
        ? `Saved ${document.kind} · ${document.status}`
        : 'Saved Architect summary',
    };
  }
  if (selected.source === 'studio') {
    const version = records.studio.versions.find((item) => item.projectId === selected.id);
    const complete = records.studio.versions.find(
      (item) => item.projectId === selected.id && item.status === 'complete',
    );
    return {
      kind: complete ? 'image' : 'summary',
      title: selected.title,
      excerpt: clip(complete?.prompt || version?.prompt || '', 400),
      imageHref: complete ? `/api/studio/image?id=${complete.id}&kind=version` : null,
      htmlPreview: null,
      fallback: complete
        ? ''
        : 'No saved Studio image is available to preview.',
      provenance: complete
        ? 'Saved Studio image · authorized account image'
        : version
          ? `Latest Studio version · ${version.status}`
          : 'Studio project without a saved version',
    };
  }
  if (selected.source === 'company') {
    const version = latestVersions(records.versions).get(selected.id);
    const slide = version?.slides[0];
    return {
      kind: slide ? 'slide' : version?.summary ? 'summary' : 'none',
      title: slide?.title || selected.title,
      excerpt: clip(slide ? `${slide.body}` : version?.summary || '', 900),
      imageHref: null,
      htmlPreview: null,
      fallback: version ? '' : 'This job has no saved deliverable excerpt yet.',
      provenance: version
        ? version.reviewedAt
          ? `Reviewed company work · revision ${version.revision}`
          : `Unreviewed company work · revision ${version.revision}`
        : 'Company job without a saved version',
    };
  }
  return {
    kind: 'conversation',
    title: selected.title,
    excerpt: '',
    imageHref: null,
    htmlPreview: null,
    fallback: 'Open Talk to read the saved conversation. Home does not reconstruct the thread.',
    provenance: 'Saved Talk title',
  };
}

export function collectAttention(
  items: CommandItem[],
  records: CommandHomeRecords,
  selected: CommandItem | null,
): AttentionItem[] {
  const latestVersion = latestVersions(records.versions);
  const found: AttentionItem[] = [];
  for (const job of records.jobs) {
    const item = items.find((entry) => entry.source === 'company' && entry.id === job.id);
    const version = latestVersion.get(job.id);
    if (!item || !version) continue;
    if (!version.reviewedAt) {
      found.push({
        id: `review:${job.id}`,
        kind: 'review-result',
        kindLabel: attentionKindLabel('review-result'),
        title: version.title || item.title,
        detail: 'A saved result is waiting for your review. This is not a formal approval.',
        source: 'Work',
        state: `Unreviewed revision ${version.revision}`,
        href: item.resumeHref,
      });
    }
    for (const gap of version.gaps.slice(0, 2)) {
      found.push({
        id: `gap:${job.id}:${gap}`,
        kind: 'missing-input',
        kindLabel: attentionKindLabel('missing-input'),
        title: clip(gap, 80),
        detail: `Documented on ${item.title}.`,
        source: 'Work',
        state: 'Recorded missing input',
        href: item.resumeHref,
      });
    }
  }
  if (selected?.source === 'architect') {
    const project = records.architect.projects.find((item) => item.id === selected.id);
    for (const document of project?.documents.filter((item) => item.status === 'draft') ?? []) {
      found.push({
        id: `draft:${document.id}`,
        kind: 'continue-draft',
        kindLabel: attentionKindLabel('continue-draft'),
        title: document.title,
        detail: `Draft ${document.kind} on ${selected.title}.`,
        source: 'Architect',
        state: 'Draft',
        href: `${selected.resumeHref}&document=${document.id}&view=document`,
      });
    }
    if (project?.running) {
      found.push({
        id: `run:${selected.id}`,
        kind: 'running-job',
        kindLabel: attentionKindLabel('running-job'),
        title: selected.title,
        detail: 'An Architect generation is still marked running. This is not background coworker execution.',
        source: 'Architect',
        state: 'Running',
        href: selected.resumeHref,
      });
    }
  }
  for (const version of records.studio.versions) {
    if (version.status !== 'pending' && version.status !== 'uncertain') continue;
    const project = items.find((item) => item.source === 'studio' && item.id === version.projectId);
    if (!project) continue;
    found.push({
      id: `studio:${version.id}`,
      kind: 'review-result',
      kindLabel: attentionKindLabel('review-result'),
      title: project.title,
      detail:
        version.status === 'uncertain'
          ? 'The last Studio save is uncertain. Inspect it in Studio before trusting the image.'
          : 'A Studio version is still pending. This is not a completed result.',
      source: 'Studio',
      state: version.status,
      href: `${project.resumeHref}&version=${version.id}`,
    });
  }
  const seen = new Set<string>();
  return found
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .slice(0, 5);
}

export function emptyArtifact(): CommandArtifact {
  return buildArtifact(null, emptyRecords(''));
}

export function projectCommandHome(
  records: CommandHomeRecords,
  requestedFocus?: string | null,
  previousKey?: string | null,
): CommandHomeData {
  const items = collectItems(records);
  const selectedKey = resolveSelectedKey(items, requestedFocus, previousKey);
  const selected = items.find((item) => item.key === selectedKey) ?? null;
  return {
    ownerId: records.ownerId,
    founderOffice: records.founderOffice,
    asOf: records.asOf,
    orientation: buildOrientation(items, selected, records.asOf),
    items,
    selectedKey,
    selected,
    artifact: buildArtifact(selected, records),
    attention: collectAttention(items, records, selected),
    sources: [
      records.architect.availability,
      records.workAvailability,
      records.studio.availability,
      records.talkAvailability,
    ],
    recentConversation: records.conversations[0]
      ? { id: records.conversations[0].id, title: records.conversations[0].title }
      : null,
  };
}

export function emptyRecords(ownerId: string, asOf = '2026-10-14T12:00:00.000Z'): CommandHomeRecords {
  return {
    ownerId,
    founderOffice: false,
    asOf,
    architect: {
      availability: {
        id: 'architect',
        state: 'closed',
        message: 'Architect persistence is not enabled in this environment.',
      },
      projects: [],
    },
    companies: [],
    jobs: [],
    versions: [],
    studio: {
      availability: {
        id: 'studio',
        state: 'closed',
        message: 'Studio is not enabled for this account.',
      },
      projects: [],
      versions: [],
    },
    conversations: [],
    workAvailability: { id: 'work', state: 'ready' },
    talkAvailability: { id: 'talk', state: 'ready' },
  };
}

export function commandFocusPayload(item: CommandItem | null) {
  if (!item) return undefined;
  return {
    commandFocus: {
      source: item.source,
      id: item.id,
      companyId: item.companyId,
      title: item.title,
      href: item.resumeHref,
    },
  };
}

function latestVersions(versions: WorkVersionRecord[]) {
  const latest = new Map<string, WorkVersionRecord>();
  for (const version of versions) {
    const current = latest.get(version.jobId);
    if (!current || version.revision > current.revision) latest.set(version.jobId, version);
  }
  return latest;
}

function clip(value: string, max: number) {
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;
}

function looksLikeHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value.slice(0, 400));
}
