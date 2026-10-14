import { initialProject, projectContentSchema, type ProjectContent } from '@/domains/architect-origin/schema';
import type {
  BriefContent,
  HandoffContent,
  PaletteContent,
  PlanContent,
  TalkCreation,
} from './schema';

export type ResolvedHandoffSource = {
  kind: 'brief' | 'plan' | 'palette';
  lineageId: string;
  versionId: string;
  version: number;
  title: string;
  content: BriefContent | PlanContent | PaletteContent;
};

export type ResolvedHandoffImage = {
  artifactId: string;
  versionId: string;
  projectId: string;
  prompt: string;
};

export type ResolvedArchitectPackage = {
  handoff: HandoffContent;
  sourceTurnId: string | null;
  brief?: BriefContent;
  plan?: PlanContent;
  palette?: PaletteContent;
  selections: ResolvedHandoffSource[];
  images: ResolvedHandoffImage[];
};

export type CopiedHandoffField = {
  into: string;
  from: string;
  truncated: boolean;
};

export type ReferencedHandoffAsset = {
  kind: 'brief' | 'plan' | 'palette' | 'image';
  title?: string;
  lineageId?: string;
  versionId: string;
  version?: number;
  artifactId?: string;
  projectId?: string;
  retainedInTalk: true;
  copiedIntoProject: false;
};

export const originImportMappingVersion = 'talk-origin-import/v1';
export const originImportNote = 'Imported from Talk';
export const uniqueKindSelectionMessage =
  'Choose one current brief, plan or palette of each kind.';

export type HandoffTransfer = {
  mappingVersion: typeof originImportMappingVersion;
  copied: CopiedHandoffField[];
  referenced: ReferencedHandoffAsset[];
  imagesCopied: false;
  paletteRolesCopied: false;
  contrastCopied: false;
};

/** Canonical length: UTF-16 code units, matching Zod `.max()` / JavaScript `.length`. */
export function utf16Length(value: string) {
  return value.length;
}

export function exceedsBound(value: string, max: number) {
  return utf16Length(value) > max;
}

/**
 * Truncate to at most `max` UTF-16 code units without splitting a surrogate pair.
 * The result also satisfies PostgreSQL character-length checks because the code-point
 * count is never greater than the UTF-16 unit count.
 */
export function boundText(value: string, max: number) {
  if (utf16Length(value) <= max) return value;
  let end = max;
  if (end > 0) {
    const unit = value.charCodeAt(end - 1);
    if (unit >= 0xd800 && unit <= 0xdbff) end -= 1;
  }
  return value.slice(0, end);
}

export function assertOneSelectionPerKind(selections: Array<{ kind: 'brief' | 'plan' | 'palette' }>) {
  const kinds = selections.map((item) => item.kind);
  if (new Set(kinds).size !== kinds.length) throw new Error(uniqueKindSelectionMessage);
}

function copiedField(into: string, from: string, source: string, max: number): CopiedHandoffField {
  return { into, from, truncated: exceedsBound(source, max) };
}

function mappedSources(resolved: ResolvedArchitectPackage) {
  const { handoff, brief, plan, palette } = resolved;
  const description = brief
    ? handoff.description || brief.purpose
    : handoff.description || handoff.idea;
  const descriptionFrom = brief
    ? handoff.description
      ? 'handoff.description'
      : 'brief.purpose'
    : handoff.description
      ? 'handoff.description'
      : 'handoff.idea';
  const requirements = brief
    ? [brief.purpose, brief.visualDirection, ...brief.requirements].filter(Boolean).join('\n')
    : '';
  const risks = brief ? brief.unresolved.join('\n') : '';
  const solution = plan
    ? [plan.summary, ...plan.steps.map((step) => `${step.title}: ${step.detail}`)].join('\n')
    : '';
  const milestones = plan ? plan.steps.map((step) => step.title).join('\n') : '';
  const deliverables = palette
    ? `Palette ${palette.title}: ${palette.swatches.map((swatch) => `${swatch.name} ${swatch.hex}`).join(', ')}`
    : '';
  const next = brief?.unresolved[0] || 'Review the imported brief in Architect before any model build.';
  const name = brief ? brief.title : handoff.idea;
  return {
    name,
    namedFromBrief: Boolean(brief),
    description,
    descriptionFrom,
    audience: brief?.audience ?? '',
    requirements,
    risks,
    solution,
    milestones,
    vision: handoff.idea,
    decisions: handoff.decisions,
    deliverables,
    next,
  };
}

export function describeHandoffTransfer(resolved: ResolvedArchitectPackage): HandoffTransfer {
  assertOneSelectionPerKind(resolved.selections);
  const { brief, plan, palette } = resolved;
  const sources = mappedSources(resolved);
  const copied: CopiedHandoffField[] = [];
  if (brief) {
    copied.push(copiedField('name', 'brief.title', sources.name, 100));
    copied.push(copiedField('description', sources.descriptionFrom, sources.description, 2000));
    copied.push(copiedField('blueprint.audience', 'brief.audience', sources.audience, 3000));
    copied.push(
      copiedField(
        'blueprint.requirements',
        'brief.purpose, brief.visualDirection, brief.requirements',
        sources.requirements,
        3000,
      ),
    );
    copied.push(copiedField('blueprint.risks', 'brief.unresolved', sources.risks, 3000));
  } else {
    copied.push(copiedField('description', sources.descriptionFrom, sources.description, 2000));
  }
  if (plan) {
    copied.push(
      copiedField('blueprint.solution', 'plan.summary and plan.steps title/detail', sources.solution, 3000),
    );
    copied.push(copiedField('blueprint.milestones', 'plan.steps.title', sources.milestones, 3000));
  }
  copied.push(copiedField('blueprint.vision', 'handoff.idea', sources.vision, 3000));
  copied.push(copiedField('blueprint.decisions', 'handoff.decisions', sources.decisions, 3000));
  if (palette) {
    copied.push(
      copiedField(
        'blueprint.deliverables',
        'palette.title and swatch name+hex (roles and contrast not copied)',
        sources.deliverables,
        3000,
      ),
    );
  }
  return {
    mappingVersion: originImportMappingVersion,
    copied,
    referenced: [
      ...resolved.selections.map((selection) => ({
        kind: selection.kind,
        title: selection.title,
        lineageId: selection.lineageId,
        versionId: selection.versionId,
        version: selection.version,
        retainedInTalk: true as const,
        copiedIntoProject: false as const,
      })),
      ...resolved.images.map((image) => ({
        kind: 'image' as const,
        versionId: image.versionId,
        artifactId: image.artifactId,
        projectId: image.projectId,
        retainedInTalk: true as const,
        copiedIntoProject: false as const,
      })),
    ],
    imagesCopied: false,
    paletteRolesCopied: false,
    contrastCopied: false,
  };
}

export function importStateText(resolved: ResolvedArchitectPackage, transfer: HandoffTransfer) {
  const copied = transfer.copied
    .map((field) => `${field.into} from ${field.from}${field.truncated ? ' (truncated)' : ''}`)
    .join('; ');
  const referenced = transfer.referenced
    .map((asset) =>
      asset.kind === 'image'
        ? `image artifact ${asset.artifactId} version ${asset.versionId} studio project ${asset.projectId}`
        : `${asset.kind} ${asset.versionId} v${asset.version}`,
    )
    .join('; ');
  return boundText(
    [
      `Imported from Talk conversation ${resolved.handoff.conversationId}. Package prepared ${resolved.handoff.preparedAt}.`,
      `Copied into this Origin project as text only: ${copied || 'none'}.`,
      `Palette roles, contrast pairs and image pixels were not copied.`,
      `Referenced and retained in Talk only: ${referenced || 'none'}.`,
      'Requirements and feasibility remain to be confirmed.',
    ].join(' '),
    3000,
  );
}

export function projectFromResolvedHandoff(resolved: ResolvedArchitectPackage): ProjectContent {
  assertOneSelectionPerKind(resolved.selections);
  const { handoff, brief, plan, palette } = resolved;
  const sources = mappedSources(resolved);
  const transfer = describeHandoffTransfer(resolved);
  const project = initialProject(handoff.idea, handoff.discipline);
  project.name = sources.namedFromBrief
    ? boundText(sources.name, 100)
    : boundText(sources.name, 100).trim() || 'Untitled project';
  project.description = boundText(sources.description, 2000);
  if (brief) {
    project.blueprint.audience = boundText(sources.audience, 3000);
    project.blueprint.requirements = boundText(sources.requirements, 3000);
    project.blueprint.risks = boundText(sources.risks, 3000);
  }
  if (plan) {
    project.blueprint.solution = boundText(sources.solution, 3000);
    project.blueprint.milestones = boundText(sources.milestones, 3000);
  }
  project.blueprint.vision = boundText(sources.vision, 3000);
  project.blueprint.decisions = boundText(sources.decisions, 3000);
  if (palette) {
    project.blueprint.deliverables = boundText(sources.deliverables, 3000);
  }
  project.blueprint.state = importStateText(resolved, transfer);
  project.blueprint.next = boundText(sources.next, 3000);
  return projectContentSchema.parse(project);
}

export function overlayHandoffImport(creation: TalkCreation, projectId?: string | null): TalkCreation {
  if (creation.kind !== 'handoff' || !('schema' in creation.content)) return creation;
  return {
    ...creation,
    originProjectId: projectId ?? null,
    content: {
      ...creation.content,
      imported: Boolean(projectId),
      ...(projectId ? { originProjectId: projectId } : {}),
    },
  };
}
