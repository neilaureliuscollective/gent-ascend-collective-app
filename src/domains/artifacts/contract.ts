import { z } from 'zod';
import type { VisualBoard } from './visual';
export const imageProposal = z
  .object({
    id: z.uuid(),
    conversationId: z.uuid(),
    operation: z.enum(['image.create', 'image.edit']),
    prompt: z.string().trim().min(3).max(3000),
    projectId: z.uuid().nullable().default(null),
  })
  .strict();
export const visualProposal = z
  .object({
    id: z.uuid(),
    conversationId: z.uuid(),
    operation: z.enum([
      'visual.diagram',
      'visual.comparison',
      'visual.chart',
      'visual.research-comparison',
    ]),
    prompt: z.string().trim().min(3).max(3000),
  })
  .strict();
export const artifactReview = z
  .object({ id: z.uuid(), approve: z.boolean(), acknowledgeCost: z.literal(true) })
  .strict();
export const artifactScenario = z
  .object({
    conversationId: z.uuid(),
    artifactId: z.uuid(),
    scenarioPercent: z.number().int().min(-50).max(50),
  })
  .strict();
export const artifactSelection = z
  .object({
    conversationId: z.uuid(),
    artifactId: z.uuid(),
    partId: z
      .string()
      .regex(/^[a-z][a-z0-9_-]{0,31}$/)
      .nullable()
      .optional(),
  })
  .strict();
export type Artifact = {
  id: string;
  conversation_id: string;
  operation:
    | 'image.create'
    | 'image.edit'
    | 'visual.diagram'
    | 'visual.comparison'
    | 'visual.chart'
    | 'visual.research-comparison'
    | 'visual.review';
  visual?: VisualBoard | null;
  review_coworker?: 'athena' | 'prometheus' | 'apollo' | 'hermes' | 'themis' | null;
  review_scope?: 'task-only' | 'selected-part' | null;
  review_context?: Record<string, unknown> | null;
  model?: string | null;
  duration_ms?: number | null;
  generation_stages?: number;
  usage_complete?: boolean;
  prompt: string;
  project_id: string | null;
  base_version_id: string | null;
  version_id: string | null;
  preview_index?: number | null;
  status: 'approval' | 'running' | 'complete' | 'failed' | 'uncertain' | 'declined';
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};
export type ArtifactWorkspace = {
  artifacts: Artifact[];
  selectedId: string | null;
  selectedPartId?: string | null;
  scenarioPercent?: number;
  projects: { id: string; title: string }[];
};
export function canEditArtifact(artifact: Artifact | undefined) {
  return (
    !!artifact && artifact.status === 'complete' && !!artifact.project_id && !!artifact.version_id
  );
}
