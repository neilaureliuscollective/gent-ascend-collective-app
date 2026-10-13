import { z } from 'zod';

export const repositoryName = z
  .string()
  .trim()
  .min(3)
  .max(160)
  .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/);
export const gitCommit = z.string().regex(/^[0-9a-f]{40}$/);
export const sha256 = z.string().regex(/^[0-9a-f]{64}$/);
export const relPath = z
  .string()
  .min(1)
  .max(240)
  .refine((value) => {
    if (value.includes('..') || value.includes('//') || value.includes('\\') || value.endsWith('/'))
      return false;
    return value.split('/').every(
      (part) =>
        part === '.env' ||
        /^\.env\.[A-Za-z0-9._-]+$/.test(part) ||
        /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(part),
    );
  }, 'Path must stay relative and cannot climb.');

export const checkCommands = ['node', 'true', 'false'] as const;
export const acceptanceCheckSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    command: z.enum(checkCommands),
    args: z.array(z.string().min(1).max(120)).max(8),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.command === 'true' || value.command === 'false') {
      if (value.args.length)
        ctx.addIssue({ code: 'custom', message: 'true/false accept no arguments.', path: ['args'] });
      return;
    }
    if (value.args[0] === '--check') {
      if (value.args.length !== 2 || !relPath.safeParse(value.args[1]).success)
        ctx.addIssue({
          code: 'custom',
          message: 'node --check requires one safe relative file.',
          path: ['args'],
        });
      return;
    }
    if (value.args.length !== 1 || !relPath.safeParse(value.args[0]).success)
      ctx.addIssue({
        code: 'custom',
        message: 'node accepts one safe relative file or --check <file>.',
        path: ['args'],
      });
  });

export const resourceLimitsSchema = z
  .object({
    timeout_ms: z.number().int().min(1000).max(120000),
    lease_ms: z.number().int().min(5000).max(180000),
    max_files: z.number().int().min(1).max(32),
    max_file_bytes: z.number().int().min(1).max(65536),
    max_output_bytes: z.number().int().min(256).max(32768),
    max_diff_bytes: z.number().int().min(256).max(65536),
  })
  .strict();

export const defaultLimits: z.infer<typeof resourceLimitsSchema> = {
  timeout_ms: 30000,
  lease_ms: 45000,
  max_files: 32,
  max_file_bytes: 65536,
  max_output_bytes: 16384,
  max_diff_bytes: 32768,
};

export const sourceFileSchema = z
  .object({
    path: relPath,
    content: z.string().max(65536),
  })
  .strict();

export const sourceKinds = ['fixture', 'imported', 'git'] as const;
export const sourceSnapshotSchema = z
  .object({
    id: z.uuid(),
    person_id: z.uuid(),
    kind: z.enum(sourceKinds),
    repository: repositoryName.nullable(),
    commit: gitCommit.nullable(),
    label: z.string().min(1).max(200),
    tree_hash: sha256,
    files: z.array(sourceFileSchema).max(32),
    created_at: z.string(),
  })
  .strict()
  .refine((value) => new Set(value.files.map((file) => file.path)).size === value.files.length, {
    message: 'Source paths must be unique.',
  })
  .refine((value) => value.kind !== 'git' || (value.repository && value.commit), {
    message: 'Git pins require repository and exact commit.',
  });

export type SourceSnapshot = z.infer<typeof sourceSnapshotSchema>;

export const patchFileSchema = z
  .object({
    path: relPath,
    before: z.string().max(65536),
    after: z.string().max(65536),
  })
  .strict();

export const briefScopeSchema = z
  .object({
    project_id: z.uuid(),
    project_revision: z.number().int().positive().max(500),
    source_id: z.uuid(),
    repository: repositoryName.nullable(),
    source_commit: gitCommit.nullable(),
    source_tree_hash: sha256,
    allowed_paths: z.array(relPath).min(1).max(32),
    protected_paths: z.array(relPath).max(32),
    intended_change: z.string().trim().min(1).max(2000),
    acceptance_checks: z.array(acceptanceCheckSchema).min(1).max(8),
    resource_limits: resourceLimitsSchema,
    patch: z.array(patchFileSchema).min(1).max(16),
  })
  .strict()
  .refine(
    (value) => new Set(value.allowed_paths).size === value.allowed_paths.length,
    'Allowed paths must be unique.',
  )
  .refine(
    (value) => value.patch.every((file) => value.allowed_paths.includes(file.path)),
    'Patch paths must be listed in the approved allowlist.',
  )
  .refine(
    (value) =>
      !value.patch.some((file) =>
        value.protected_paths.some(
          (protectedPath) =>
            file.path === protectedPath || file.path.startsWith(`${protectedPath}/`),
        ),
      ),
    'Patch cannot target a protected path.',
  );

export type BriefScope = z.infer<typeof briefScopeSchema>;

export const briefStatuses = ['approved', 'invalidated'] as const;
export const constructBriefSchema = z
  .object({
    id: z.uuid(),
    person_id: z.uuid(),
    approval_hash: sha256,
    status: z.enum(briefStatuses),
    invalidation_reason: z.string().max(300).nullable(),
    scope: briefScopeSchema,
    created_at: z.string(),
  })
  .strict();
export type ConstructBrief = z.infer<typeof constructBriefSchema>;

export const checkStatuses = ['passed', 'failed', 'blocked', 'not-run'] as const;
export const checkResultSchema = z
  .object({
    name: z.string().min(1).max(80),
    command: z.string().min(1).max(200),
    exit_code: z.number().int().min(-1).max(255),
    status: z.enum(checkStatuses),
    log: z.string().max(16384),
  })
  .strict();

export const isolationKinds = ['docker', 'process-fixture', 'unavailable'] as const;
export const runResultSchema = z
  .object({
    isolation: z.enum(isolationKinds),
    runtime_available: z.boolean(),
    sandbox: z.boolean(),
    blocker: z.string().max(400).nullable(),
    source_hash: sha256,
    result_hash: sha256.nullable(),
    changed_files: z.array(relPath).max(32),
    diff: z.string().max(65536),
    checks: z.array(checkResultSchema).max(8),
    preview: z
      .object({
        path: relPath.nullable(),
        body: z.string().max(32768),
        unavailable_reason: z.string().max(300).nullable(),
      })
      .strict(),
    artifacts: z
      .array(
        z
          .object({
            kind: z.enum(['diff', 'preview', 'log', 'receipt']),
            ref: z.string().min(1).max(240),
            hash: sha256,
          })
          .strict(),
      )
      .max(8),
  })
  .strict()
  .refine((value) => value.isolation !== 'process-fixture' || !value.sandbox, {
    message: 'The process fixture is not a sandbox.',
  })
  .refine((value) => !value.sandbox || (value.isolation === 'docker' && value.runtime_available), {
    message: 'sandbox:true requires verified disposable-container execution.',
  });
export type RunResult = z.infer<typeof runResultSchema>;

export const runStatuses = [
  'queued',
  'claimed',
  'running',
  'succeeded',
  'failed',
  'cancelled',
  'blocked',
  'timed_out',
] as const;
export type RunStatus = (typeof runStatuses)[number];
export const terminalStatuses = [
  'succeeded',
  'failed',
  'cancelled',
  'blocked',
  'timed_out',
] as const;

export const constructRunSchema = z
  .object({
    id: z.uuid(),
    person_id: z.uuid(),
    project_id: z.uuid(),
    brief_id: z.uuid(),
    approval_hash: sha256,
    source_id: z.uuid(),
    source_kind: z.enum(sourceKinds),
    source_tree_hash: sha256,
    project_revision: z.number().int().positive(),
    status: z.enum(runStatuses),
    cancel_requested: z.boolean(),
    worker_id: z.string().max(80).nullable(),
    lease_token: z.uuid().nullable(),
    lease_until: z.string().nullable(),
    result: runResultSchema.nullable(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .strict();
export type ConstructRun = z.infer<typeof constructRunSchema>;

export const eventKinds = [
  'queued',
  'claimed',
  'lease_recovered',
  'started',
  'source_prepared',
  'patch_applied',
  'check_started',
  'check_finished',
  'preview_collected',
  'blocked',
  'cancelled',
  'timed_out',
  'finished',
] as const;
export const constructEventSchema = z
  .object({
    id: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
    run_id: z.uuid(),
    person_id: z.uuid(),
    seq: z.number().int().positive(),
    kind: z.enum(eventKinds),
    detail: z.string().max(2000),
    created_at: z.string(),
  })
  .strict();
export type ConstructEvent = z.infer<typeof constructEventSchema>;

export const startCommand = z
  .object({
    action: z.literal('start'),
    projectId: z.uuid(),
    briefId: z.uuid(),
    requestId: z.uuid(),
    expected: z.number().int().positive().max(500),
  })
  .strict();
export const startFixtureCommand = z
  .object({
    action: z.literal('start-fixture'),
    projectId: z.uuid(),
    requestId: z.uuid(),
    expected: z.number().int().positive().max(500),
  })
  .strict();
export const cancelCommand = z
  .object({
    action: z.literal('cancel'),
    projectId: z.uuid(),
    runId: z.uuid(),
  })
  .strict();
export const constructCommand = z.discriminatedUnion('action', [
  startCommand,
  startFixtureCommand,
  cancelCommand,
]);

export const sourceKindLabels: Record<(typeof sourceKinds)[number], string> = {
  fixture: 'Deterministic fixture source — labelled test tree, not an imported application snapshot.',
  imported: 'Imported source snapshot — exact attached files, not live repository knowledge.',
  git: 'Git commit pin only. Missing imported tree is a blocker; the model cannot invent repository files.',
};

export function defaultProtectedPaths() {
  return ['.env', '.env.local', '.env.development.local', 'secrets', 'credentials.json'];
}
