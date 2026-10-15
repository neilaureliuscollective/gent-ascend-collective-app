import { z } from 'zod';
import {
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
  dateFrom: null,
  dateTo: null,
  density: 'comfortable',
  arrangement: 'timeline',
  comparisonDrawer: true,
  dateRange: true,
});

export const routineProgressSchema = z
  .object({
    constraint: z
      .object({
        availableMinutes: z.number().int().min(4).max(90),
        finishAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        selected: z.array(z.enum(eveningStepIds)).min(1).max(8),
      })
      .strict(),
    accepted: z.unknown(),
    pending: z.unknown().nullable(),
    timer: z
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
      .nullable(),
    completed: z.array(z.enum(eveningStepIds)).max(8),
    notes: z.record(z.string(), z.string().max(400)).default({}),
    activeStepId: z.enum(eveningStepIds).nullable(),
  })
  .strict();

export const workspaceSettingsSchema = z
  .object({
    presentation: trustedPresentationSchema,
    bloodwork: bloodworkSettingsSchema.optional(),
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
  created_at: string;
};

export function defaultWorkspaceSettings(foundation: HealthFoundationId): WorkspaceSettings {
  const presentation: TrustedPresentation = defaultPresentation(foundation);
  return {
    presentation,
    bloodwork: foundation === 'bloodwork-tracker' ? defaultBloodworkSettings() : undefined,
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
  return { ...row, settings, progress };
}

export const selectedElementSchema = z
  .object({
    kind: z.enum(['step', 'marker', 'document', 'timer', 'constraint', 'chart']),
    id: z.string().min(1).max(120),
  })
  .strict();
export type SelectedElement = z.infer<typeof selectedElementSchema>;
