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

function clip(value: string, max: number) {
  return value.slice(0, max);
}

export function projectFromResolvedHandoff(resolved: ResolvedArchitectPackage): ProjectContent {
  const { handoff, brief, plan, palette } = resolved;
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
  project.blueprint.state = clip(
    `Imported from Talk conversation ${handoff.conversationId}. Package prepared ${handoff.preparedAt}. Requirements and feasibility remain to be confirmed.`,
    3000,
  );
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
