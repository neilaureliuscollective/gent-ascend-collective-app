import { z } from 'zod';
import type { ArchitectAttempt } from './architect-adapter';
import { ARCHITECT_APPS_DEPENDENCY } from './architect-adapter';
import type { HealthWorkspaceRecord } from './workspace-model';
import { bloodworkSettingsSchema, workspaceSettingsSchema } from './workspace-model';
import { routineProgressSchema } from './workspace-model';
import { healthFoundations } from './foundations';

export const purposes = ['wellness', 'records', 'ai'] as const;
export type Purpose = (typeof purposes)[number];
export const observationSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(120),
    code: z.string().trim().max(40).default(''),
    value: z.string().trim().min(1).max(100),
    unit: z.string().trim().max(30),
    date: z.iso.date(),
    specimen: z.string().trim().max(80).default(''),
    method: z.string().trim().max(100).default(''),
    range: z.string().trim().max(100).default(''),
    flag: z.string().trim().max(40).default(''),
  })
  .strict();
export type Observation = z.infer<typeof observationSchema>;
export type HealthRecord = {
  id: string;
  title: string;
  mime: string;
  size: number;
  path: string;
  hash: string | null;
  status: 'reserved' | 'review_required' | 'confirmed' | 'unsupported' | 'failed' | 'deleting';
  version: number;
  created_at: string;
  candidates: Observation[];
};
export type SavedObservation = Observation & {
  record_id: string;
  version: number;
  status: 'active' | 'excluded';
  confirmed_at: string;
};
export type Consent = { purpose: Purpose; granted: boolean; version: number; updated_at: string };
export type HealthJob = {
  id: string;
  kind: 'delete' | 'export';
  record_id: string | null;
  status: 'pending' | 'running' | 'complete' | 'failed';
  created_at: string;
};
export type HealthTurn = {
  id: string;
  question: string;
  answer: string;
  status: 'pending' | 'complete' | 'failed';
  created_at: string;
  evidence: string[];
};
export type WellnessPoint = {
  originalValue?: number;
  originalUnit?: string;
  date: string;
  value: number;
  source: string;
  updatedAt: string;
  version: number;
};
export type HealthData = {
  owner: string | null;
  mode: 'personal' | 'signed-out' | 'unavailable';
  records: HealthRecord[];
  observations: SavedObservation[];
  consents: Consent[];
  jobs: HealthJob[];
  turns: HealthTurn[];
  wellness: {
    sleep: WellnessPoint[];
    weight: WellnessPoint[];
    movement: WellnessPoint[];
    recovery: {
      date: string;
      energy: number | null;
      soreness: string | null;
      updatedAt: string;
      version: number;
    }[];
    unavailable: string[];
  };
  ingestionEnabled: boolean;
  aiEnabled: boolean;
  workspaces: HealthWorkspaceRecord[];
  architect: {
    status: 'available' | 'blocked';
    blocker: string | null;
    dependency: typeof ARCHITECT_APPS_DEPENDENCY;
  };
  asOf: string;
};
export const amendmentSchema = z
  .object({
    id: z.uuid(),
    expected: z.number().int().positive(),
    observation: observationSchema,
    reason: z.string().trim().min(3).max(300),
    excluded: z.boolean(),
  })
  .strict();
export const mutationSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('consent'),
      request: z.uuid(),
      purpose: z.enum(purposes),
      granted: z.boolean(),
      adult: z.boolean(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('confirm'),
      request: z.uuid(),
      id: z.uuid(),
      expected: z.number().int().positive(),
      observations: z.array(observationSchema).min(1).max(100),
    })
    .strict(),
  amendmentSchema.extend({ kind: z.literal('amend'), request: z.uuid() }),
  z.object({ kind: z.literal('delete'), request: z.uuid(), id: z.uuid().nullable() }).strict(),
  z.object({ kind: z.literal('resume'), request: z.uuid(), id: z.uuid() }).strict(),
  z.object({ kind: z.literal('export'), request: z.uuid() }).strict(),
  z
    .object({
      kind: z.literal('ask'),
      request: z.uuid(),
      question: z.string().trim().min(3).max(3000),
      evidence: z.array(z.uuid()).max(12),
      consentVersion: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('workspace_save'),
      request: z.uuid(),
      id: z.uuid(),
      expected: z.number().int().positive(),
      foundation: z.enum(healthFoundations),
      title: z.string().trim().min(1).max(120),
      sample: z.boolean(),
      settings: workspaceSettingsSchema,
      progress: routineProgressSchema.nullable(),
      architect: z.unknown().nullable(),
      open: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('workspace_copy'),
      request: z.uuid(),
      id: z.uuid(),
      sourceId: z.uuid(),
      title: z.string().trim().min(1).max(120),
    })
    .strict(),
  z
    .object({
      kind: z.literal('workspace_restore'),
      request: z.uuid(),
      id: z.uuid(),
      expected: z.number().int().positive(),
      revision: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('workspace_bridge'),
      request: z.uuid(),
      id: z.uuid(),
      expected: z.number().int().positive(),
      action: z.enum(['issue', 'revoke']),
      fields: z.array(z.string().min(1).max(40)).max(12).optional(),
    })
    .strict(),
]);
export type Mutation = z.infer<typeof mutationSchema>;
export function emptyHealth(mode: HealthData['mode'] = 'signed-out'): HealthData {
  return {
    owner: null,
    mode,
    records: [],
    observations: [],
    consents: [],
    jobs: [],
    turns: [],
    wellness: { sleep: [], weight: [], movement: [], recovery: [], unavailable: [] },
    ingestionEnabled: false,
    aiEnabled: false,
    workspaces: [],
    architect: {
      status: 'blocked',
      blocker: `Dynamic compilation is blocked until Architect Apps PR #${ARCHITECT_APPS_DEPENDENCY.pr} is merged.`,
      dependency: ARCHITECT_APPS_DEPENDENCY,
    },
    asOf: new Date().toISOString(),
  };
}

export type ArchitectSnapshot = HealthData['architect'];
export type { ArchitectAttempt, HealthWorkspaceRecord };
export { bloodworkSettingsSchema };
