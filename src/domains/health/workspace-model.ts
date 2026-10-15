import { z } from 'zod';
import {
  architectAttemptSchema,
  defaultPresentation,
  trustedPresentationSchema,
  type ArchitectAttempt,
  type TrustedPresentation,
} from './architect-adapter';
import { healthFoundations, type HealthFoundationId } from './foundations';
import { defaultEveningProgress, eveningStepIds, type RoutineProgress } from './routine';

export const workspaceKind = z.enum(healthFoundations);
export const bloodworkDensity = z.enum(['comfortable', 'compact']);
export const bloodworkArrangement = z.enum(['timeline', 'markers']);

export const bloodworkSettingsSchema = z
  .object({
    markerKeys: z.array(z.string().min(1).max(240)).max(24),
    focusKey: z.string().min(1).max(240).nullable().default(null),
    dateFrom: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    dateTo: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    density: bloodworkDensity,
    arrangement: bloodworkArrangement,
    comparisonDrawer: z.boolean(),
    dateRange: z.boolean(),
  })
  .strict();
export type BloodworkSettings = z.infer<typeof bloodworkSettingsSchema>;

export const defaultBloodworkSettings = (): BloodworkSettings => ({
  markerKeys: [],
  focusKey: null,
  dateFrom: null,
  dateTo: null,
  density: 'comfortable',
  arrangement: 'timeline',
  comparisonDrawer: true,
  dateRange: true,
});

export const plannedStepSchema = z
  .object({
    id: z.enum(eveningStepIds),
    title: z.string().min(1).max(120),
    minutes: z.number().int().min(1).max(90),
    kind: z.enum(['timer', 'action']),
    note: z.string().max(400),
    optional: z.boolean(),
    scheduledMinutes: z.number().int().min(0).max(90),
    included: z.boolean(),
  })
  .strict();

export const routinePlanSchema = z
  .object({
    availableMinutes: z.number().int().min(4).max(90),
    usedMinutes: z.number().int().min(0).max(90),
    remainingMinutes: z.number().int().min(0).max(90),
    steps: z.array(plannedStepSchema).max(8),
    dropped: z
      .array(
        z
          .object({
            id: z.enum(eveningStepIds),
            title: z.string().min(1).max(120),
            reason: z.string().max(240),
          })
          .strict(),
      )
      .max(8),
    shortened: z
      .array(
        z
          .object({
            id: z.enum(eveningStepIds),
            from: z.number().int().min(1).max(90),
            to: z.number().int().min(1).max(90),
          })
          .strict(),
      )
      .max(8),
    explanation: z.string().max(400),
  })
  .strict();

export const routineTimerSchema = z
  .object({
    stepId: z.enum(eveningStepIds),
    durationMs: z
      .number()
      .int()
      .positive()
      .max(90 * 60_000),
    remainingMs: z
      .number()
      .int()
      .nonnegative()
      .max(90 * 60_000),
    running: z.boolean(),
    startedAt: z.string().nullable(),
  })
  .strict();

export const routineProgressSchema = z
  .object({
    constraint: z
      .object({
        availableMinutes: z.number().int().min(4).max(90),
        finishAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        selected: z.array(z.enum(eveningStepIds)).min(1).max(8),
      })
      .strict(),
    accepted: routinePlanSchema,
    pending: routinePlanSchema.nullable(),
    timer: routineTimerSchema.nullable(),
    completed: z.array(z.enum(eveningStepIds)).max(8),
    notes: z.record(z.string(), z.string().max(400)).default({}),
    activeStepId: z.enum(eveningStepIds).nullable(),
  })
  .strict();

export const toolSectionKind = z.enum([
  'hero',
  'sequence',
  'notes',
  'trend',
  'table',
  'source',
]);
export type ToolSectionKind = z.infer<typeof toolSectionKind>;

export const toolDisplay = z.enum([
  'hero-next',
  'sequence-list',
  'notes-panel',
  'chart',
  'table',
  'source-inspect',
]);
export type ToolDisplay = z.infer<typeof toolDisplay>;

export const toolSectionSchema = z
  .object({
    id: z.uuid(),
    kind: toolSectionKind,
    title: z.string().min(1).max(80),
    display: toolDisplay,
    visible: z.boolean(),
  })
  .strict();
export type ToolSection = z.infer<typeof toolSectionSchema>;

export const toolCompositionSchema = z
  .object({
    schemaVersion: z.literal(1),
    intent: z.string().max(400).optional(),
    sections: z.array(toolSectionSchema).max(12),
  })
  .strict();
export type ToolComposition = z.infer<typeof toolCompositionSchema>;

export const workspaceSettingsSchema = z
  .object({
    presentation: trustedPresentationSchema,
    bloodwork: bloodworkSettingsSchema.optional(),
    composition: toolCompositionSchema.optional(),
  })
  .strict();
export type WorkspaceSettings = z.infer<typeof workspaceSettingsSchema>;

export type HealthWorkspaceRecord = {
  id: string;
  foundation: HealthFoundationId;
  title: string;
  sample: boolean;
  version: number;
  workingRevision: number;
  lastWorkingRevision: number;
  settings: WorkspaceSettings;
  progress: RoutineProgress | null;
  architect: ArchitectAttempt | null;
  created_at: string;
  updated_at: string;
  last_opened_at: string;
};

export type HealthWorkspaceRevision = {
  workspace_id: string;
  revision: number;
  settings: WorkspaceSettings;
  progress: RoutineProgress | null;
  architect: ArchitectAttempt | null;
  created_at: string;
};

export function defaultWorkspaceSettings(foundation: HealthFoundationId): WorkspaceSettings {
  const presentation: TrustedPresentation = defaultPresentation(foundation);
  return {
    presentation,
    bloodwork: foundation === 'bloodwork-tracker' ? defaultBloodworkSettings() : undefined,
    composition: undefined,
  };
}

export function createWorkspaceDraft(
  foundation: HealthFoundationId,
  options?: { id?: string; sample?: boolean; title?: string; now?: string },
): HealthWorkspaceRecord {
  const now = options?.now ?? new Date().toISOString();
  return {
    id: options?.id ?? crypto.randomUUID(),
    foundation,
    title:
      options?.title ??
      (foundation === 'evening-routine' ? 'Evenings, made usable' : 'Bloodwork Tracker'),
    sample: Boolean(options?.sample),
    version: 1,
    workingRevision: 1,
    lastWorkingRevision: 1,
    settings: defaultWorkspaceSettings(foundation),
    progress: foundation === 'evening-routine' ? defaultEveningProgress() : null,
    architect: null,
    created_at: now,
    updated_at: now,
    last_opened_at: now,
  };
}

export function workspaceFromRow(row: HealthWorkspaceRecord): HealthWorkspaceRecord {
  const settings = workspaceSettingsSchema.parse(row.settings);
  const progress =
    row.foundation === 'evening-routine'
      ? (routineProgressSchema.parse(row.progress ?? defaultEveningProgress()) as RoutineProgress)
      : null;
  const architect = row.architect ? architectAttemptSchema.parse(row.architect) : null;
  return { ...row, settings, progress, architect };
}

export const selectedElementSchema = z
  .object({
    kind: z.enum(['step', 'marker', 'document', 'timer', 'constraint', 'chart', 'section']),
    id: z.string().min(1).max(120),
  })
  .strict();
export type SelectedElement = z.infer<typeof selectedElementSchema>;
