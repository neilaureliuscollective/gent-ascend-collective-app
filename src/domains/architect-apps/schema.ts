import { z } from 'zod';
import {
  APP_PROFILE,
  APP_PROFILE_VERSION,
  APP_TOOLCHAIN_VERSION,
  isGeneratedAppPath,
  isSealedAppPath,
} from './catalog';

export const sha256 = z.string().regex(/^[0-9a-f]{64}$/);

export const appRelPath = z
  .string()
  .min(1)
  .max(240)
  .refine((value) => {
    if (value.includes('..') || value.includes('//') || value.includes('\\') || value.endsWith('/'))
      return false;
    return value.split('/').every((part) => /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(part));
  }, 'Path must stay relative and cannot climb.');

export const appFileSchema = z
  .object({
    path: appRelPath,
    content: z.string().max(80000),
  })
  .strict();

export type AppFile = z.infer<typeof appFileSchema>;

export const fileOperationSchema = z
  .object({
    op: z.enum(['create', 'update', 'delete']),
    path: appRelPath,
    content: z.string().max(80000).optional(),
    baseHash: sha256.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!isGeneratedAppPath(value.path) || isSealedAppPath(value.path)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Only approved generated-app paths under src/ may change.',
        path: ['path'],
      });
    }
    if (value.op === 'delete' && value.content)
      ctx.addIssue({ code: 'custom', message: 'Delete operations cannot carry content.', path: ['content'] });
    if (value.op !== 'delete' && (value.content == null || value.content.length === 0))
      ctx.addIssue({ code: 'custom', message: 'Create and update require file content.', path: ['content'] });
    if (value.op !== 'create' && !value.baseHash)
      ctx.addIssue({
        code: 'custom',
        message: 'Update and delete bind to the exact base content hash.',
        path: ['baseHash'],
      });
  });

export type FileOperation = z.infer<typeof fileOperationSchema>;

export const collectionFieldSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(40)
      .regex(/^[A-Za-z][A-Za-z0-9_]*$/),
    type: z.enum(['string', 'number', 'enum', 'boolean']),
    required: z.boolean(),
    max: z.number().int().positive().max(2000).optional(),
    values: z.array(z.string().min(1).max(32)).max(12).optional(),
  })
  .strict();

export const collectionSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(40)
      .regex(/^[A-Za-z][A-Za-z0-9_]*$/),
    fields: z.array(collectionFieldSchema).min(1).max(16),
  })
  .strict();

export type AppCollection = z.infer<typeof collectionSchema>;

export const appBehaviorsSchema = z
  .object({
    navigation: z.boolean(),
    forms: z.boolean(),
    validation: z.boolean(),
    filtering: z.boolean(),
    calculations: z.boolean(),
    persistence: z.boolean(),
  })
  .strict();

export type AppBehaviors = z.infer<typeof appBehaviorsSchema>;

export const generationMode = z.enum(['fixture', 'mock', 'openai', 'unknown']);

export const appProposalSchema = z
  .object({
    summary: z.string().trim().min(1).max(2000),
    files: z.array(appFileSchema).min(1).max(40),
    operations: z.array(fileOperationSchema).max(40).optional(),
    collections: z.array(collectionSchema).min(1).max(4),
    behaviors: appBehaviorsSchema,
    notes: z.string().max(2000),
  })
  .strict();

export type AppProposal = z.infer<typeof appProposalSchema>;

export const defaultAppLimits = {
  timeout_ms: 90000,
  lease_ms: 120000,
  max_files: 40,
  max_file_bytes: 80000,
  max_generated_bytes: 400000,
  max_artifact_bytes: 1500000,
  max_records: 200,
  max_record_bytes: 8000,
  data_rate_per_minute: 60,
};

export const jobStatuses = ['queued', 'running', 'succeeded', 'failed', 'cancelled'] as const;
export const terminalJobStatuses = ['succeeded', 'failed', 'cancelled'] as const;
export const eventKinds = ['queued', 'started', 'typecheck', 'bundle', 'preview', 'failed', 'cancelled'] as const;

export type AppRevision = {
  id: string;
  app_id: string;
  person_id: string;
  project_id: string;
  revision: number;
  parent_revision: number | null;
  tree_hash: string;
  approval_hash: string;
  profile: typeof APP_PROFILE;
  profile_version: typeof APP_PROFILE_VERSION;
  toolchain: typeof APP_TOOLCHAIN_VERSION;
  files: AppFile[];
  collections: AppCollection[];
  behaviors: AppBehaviors;
  generation: { mode: z.infer<typeof generationMode>; notes?: string };
  status: 'approved' | 'building' | 'ready' | 'failed' | 'superseded';
  working: boolean;
  created_at: string;
};

export type AppArtifact = {
  revision_id: string;
  person_id: string;
  project_id: string;
  manifest_hash: string;
  files: AppFile[];
  created_at: string;
};

export type AppJob = {
  id: string;
  person_id: string;
  project_id: string;
  app_id: string;
  revision_id: string;
  approval_hash: string;
  status: (typeof jobStatuses)[number];
  cancel_requested: boolean;
  worker_id: string | null;
  lease_token: string | null;
  lease_until: string | null;
  result: AppJobResult | null;
  created_at: string;
  updated_at: string;
};

export type AppJobResult = {
  ok: boolean;
  isolation: 'docker' | 'host-fixture' | 'unavailable';
  sandbox: boolean;
  toolchain?: string;
  typecheck: { ok: boolean; log: string };
  bundle: { ok: boolean; log: string };
  blocker: string | null;
  stages: { kind: (typeof eventKinds)[number]; at: string; detail: string }[];
};

export type AppEvent = {
  id: string;
  job_id: string;
  person_id: string;
  kind: (typeof eventKinds)[number];
  detail: string;
  created_at: string;
};

export type AppRecord = {
  id: string;
  person_id: string;
  project_id: string;
  app_id: string;
  collection: string;
  payload: Record<string, unknown>;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
};

export type ArchitectApp = {
  id: string;
  person_id: string;
  project_id: string;
  name: string;
  current_revision: number;
  last_working_revision: number | null;
  created_at: string;
  updated_at: string;
};

export const proposeAppCommand = z
  .object({
    action: z.literal('propose'),
    projectId: z.uuid(),
    requestId: z.uuid(),
    expected: z.number().int().nonnegative().max(500),
    instruction: z.string().trim().min(1).max(2000),
    kind: z.enum(['create', 'revise']),
    baseRevision: z.number().int().positive().max(500).optional(),
    demo: z.enum(['tracker', 'none']).default('none'),
  })
  .strict();

export const approveAppCommand = z
  .object({
    action: z.literal('approve'),
    projectId: z.uuid(),
    requestId: z.uuid(),
    expected: z.number().int().nonnegative().max(500),
    approvalHash: sha256,
    proposal: appProposalSchema,
    generation: z
      .object({
        mode: generationMode,
        notes: z.string().max(400).optional(),
      })
      .strict(),
    baseRevision: z.number().int().positive().max(500).nullable(),
  })
  .strict();

export const startAppCommand = z
  .object({
    action: z.literal('start'),
    projectId: z.uuid(),
    revisionId: z.uuid(),
    requestId: z.uuid(),
    expected: z.number().int().nonnegative().max(500),
    approvalHash: sha256,
  })
  .strict();

export const cancelAppCommand = z
  .object({
    action: z.literal('cancel'),
    projectId: z.uuid(),
    jobId: z.uuid(),
  })
  .strict();

export const reopenAppCommand = z
  .object({
    action: z.literal('reopen'),
    projectId: z.uuid(),
    revision: z.number().int().positive().max(500),
  })
  .strict();

export const PREVIEW_SESSION_MAX = 96;
export const APP_DATA_SCHEMA = 'architect-apps-data/v1';

export const appDataCommand = z
  .object({
    action: z.literal('data'),
    schema: z.literal('architect-apps-data/v1'),
    projectId: z.uuid(),
    revisionId: z.uuid(),
    session: z.string().min(16).max(PREVIEW_SESSION_MAX),
    requestId: z.uuid(),
    operation: z.enum(['list', 'get', 'create', 'update']),
    collection: z.string().trim().min(1).max(40),
    payload: z.record(z.string(), z.unknown()).optional(),
    idempotencyKey: z.string().min(1).max(80).optional(),
  })
  .strict();

export const appCommand = z.discriminatedUnion('action', [
  proposeAppCommand,
  approveAppCommand,
  startAppCommand,
  cancelAppCommand,
  reopenAppCommand,
]);
