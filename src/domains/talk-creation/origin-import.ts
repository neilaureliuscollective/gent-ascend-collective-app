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

export type HandoffTransfer = {
  mappingVersion: typeof originImportMappingVersion;
  copied: CopiedHandoffField[];
  referenced: ReferencedHandoffAsset[];
  imagesCopied: false;
  paletteRolesCopied: false;
  contrastCopied: false;
};

function clip(value: string, max: number) {
  return value.slice(0, max);
}

export function describeHandoffTransfer(resolved: ResolvedArchitectPackage): HandoffTransfer {
  const { handoff, brief, plan, palette } = resolved;
  const copied: CopiedHandoffField[] = [];
  if (brief) {
    copied.push({ into: 'name', from: 'brief.title', truncated: brief.title.length > 100 });
    copied.push({
      into: 'description',
      from: handoff.description ? 'handoff.description' : 'brief.purpose',
      truncated: (handoff.description || brief.purpose).length > 2000,
    });
    copied.push({
      into: 'blueprint.audience',
      from: 'brief.audience',
      truncated: brief.audience.length > 3000,
    });
    copied.push({
      into: 'blueprint.requirements',
      from: 'brief.purpose, brief.visualDirection, brief.requirements',
      truncated: [brief.purpose, brief.visualDirection, ...brief.requirements].filter(Boolean).join('\n').length > 3000,
    });
    copied.push({
      into: 'blueprint.risks',
      from: 'brief.unresolved',
      truncated: brief.unresolved.join('\n').length > 3000,
    });
  } else {
    copied.push({
      into: 'description',
      from: handoff.description ? 'handoff.description' : 'handoff.idea',
      truncated: (handoff.description || handoff.idea).length > 2000,
    });
  }
  if (plan) {
    copied.push({
      into: 'blueprint.solution',
      from: 'plan.summary and plan.steps title/detail',
      truncated: [plan.summary, ...plan.steps.map((step) => `${step.title}: ${step.detail}`)].join('\n').length > 3000,
    });
    copied.push({
      into: 'blueprint.milestones',
      from: 'plan.steps.title',
      truncated: plan.steps.map((step) => step.title).join('\n').length > 3000,
    });
  }
  copied.push({ into: 'blueprint.vision', from: 'handoff.idea', truncated: handoff.idea.length > 3000 });
  copied.push({
    into: 'blueprint.decisions',
    from: 'handoff.decisions',
    truncated: handoff.decisions.length > 3000,
  });
  if (palette) {
    copied.push({
      into: 'blueprint.deliverables',
      from: 'palette.title and swatch name+hex (roles and contrast not copied)',
      truncated:
        `Palette ${palette.title}: ${palette.swatches.map((swatch) => `${swatch.name} ${swatch.hex}`).join(', ')}`
          .length > 3000,
    });
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
  return clip(
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
  const { handoff, brief, plan, palette } = resolved;
  const transfer = describeHandoffTransfer(resolved);
  const project = initialProject(handoff.idea, handoff.discipline);
  if (brief) {
    project.name = clip(brief.title, 100);
    project.description = clip(handoff.description || brief.purpose, 2000);
    project.blueprint.audience = clip(brief.audience, 3000);
    project.blueprint.requirements = clip(
      [brief.purpose, brief.visualDirection, ...brief.requirements].filter(Boolean).join('\n'),
      3000,
    );
    project.blueprint.risks = clip(brief.unresolved.join('\n'), 3000);
  } else {
    project.description = clip(handoff.description || handoff.idea, 2000);
  }
  if (plan) {
    project.blueprint.solution = clip(
      [plan.summary, ...plan.steps.map((step) => `${step.title}: ${step.detail}`)].join('\n'),
      3000,
    );
    project.blueprint.milestones = clip(plan.steps.map((step) => step.title).join('\n'), 3000);
  }
  project.blueprint.vision = clip(handoff.idea, 3000);
  project.blueprint.decisions = clip(handoff.decisions, 3000);
  if (palette) {
    project.blueprint.deliverables = clip(
      `Palette ${palette.title}: ${palette.swatches.map((swatch) => `${swatch.name} ${swatch.hex}`).join(', ')}`,
      3000,
    );
  }
  project.blueprint.state = importStateText(resolved, transfer);
  project.blueprint.next = clip(
    brief?.unresolved[0] || 'Review the imported brief in Architect before any model build.',
    3000,
  );
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
