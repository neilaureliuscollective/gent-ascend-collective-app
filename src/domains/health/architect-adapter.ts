import { z } from 'zod';
import { healthApprovedSource, healthSyntheticExample } from './architect-source';

/** Exact unmerged Architect Apps runtime this Health phase depends on. Do not silently vendor the engine. */
export const ARCHITECT_APPS_DEPENDENCY = {
  pr: 130,
  branch: 'cursor/architect-create-apps-501f',
  commit: '3248e8da6fce8b56af9fd310b7ad66ea02312248',
  inspectedAt: '2026-10-15',
} as const;

export const HEALTH_ARCHITECT_CONTRACT_VERSION = 1;

export const sealedHealthSurfaces = [
  'records',
  'units',
  'provenance',
  'comparisons',
  'corrections',
  'deletion',
  'consent',
] as const;

export const generatedHealthSurfaces = [
  'presentation',
  'layout',
  'filters',
  'interaction',
] as const;

export const healthArchitectContract = {
  version: HEALTH_ARCHITECT_CONTRACT_VERSION,
  sealed: sealedHealthSurfaces,
  generated: generatedHealthSurfaces,
  network: 'deny',
  privilegedHost: 'deny',
  clinicalWrites: 'deny',
  recordProjection: 'host-controlled-readonly',
  exampleRevision: {
    id: 'date-range-comparison-drawer',
    summary: 'Add a date-range interaction and a compact comparison drawer.',
  },
};

export type ArchitectRuntimeStatus = 'available' | 'blocked';
export type ArchitectIsolation = 'docker' | 'host-fixture' | 'unavailable';

export type ArchitectJobStage = {
  kind: 'proposed' | 'compiled' | 'preview' | 'accepted' | 'failed' | 'blocked' | 'restored';
  at: string;
  detail: string;
};

export type ArchitectAttempt = {
  id: string;
  workspaceId: string;
  instruction: string;
  status: 'blocked' | 'failed' | 'ready' | 'accepted';
  workingRevision: number;
  attemptedRevision: number;
  diff: { path: string; before: string; after: string }[];
  stages: ArchitectJobStage[];
  blocker: string | null;
  isolation: ArchitectIsolation | null;
  sourceHash: string | null;
  artifactHash: string | null;
  previewOk: boolean;
  verified: boolean;
};

export const architectAttemptSchema = z
  .object({
    id: z.uuid(),
    workspaceId: z.uuid(),
    instruction: z.string().max(2000),
    status: z.enum(['blocked', 'failed', 'ready', 'accepted']),
    workingRevision: z.number().int().min(1).max(5000),
    attemptedRevision: z.number().int().min(1).max(5000),
    diff: z
      .array(
        z
          .object({
            path: z.string().min(1).max(200),
            before: z.string().max(4000),
            after: z.string().max(4000),
          })
          .strict(),
      )
      .max(40),
    stages: z
      .array(
        z
          .object({
            kind: z.enum([
              'proposed',
              'compiled',
              'preview',
              'accepted',
              'failed',
              'blocked',
              'restored',
            ]),
            at: z.string().min(1).max(80),
            detail: z.string().max(2000),
          })
          .strict(),
      )
      .max(24),
    blocker: z.string().max(2000).nullable(),
    isolation: z.enum(['docker', 'host-fixture', 'unavailable']).nullable(),
    sourceHash: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .nullable(),
    artifactHash: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .nullable(),
    previewOk: z.boolean(),
    verified: z.boolean(),
  })
  .strict();

export type ArchitectAppsRuntime = {
  propose(input: {
    workspaceId: string;
    instruction: string;
    contract: typeof healthArchitectContract;
    source: { path: string; content: string }[];
    syntheticExample: unknown;
  }): Promise<{
    summary: string;
    files: { path: string; content: string }[];
    diff: ArchitectAttempt['diff'];
  }>;
  compile(proposal: { files: { path: string; content: string }[] }): Promise<{
    ok: boolean;
    log: string;
    isolation: ArchitectIsolation;
    receipt?: string;
  }>;
  preview(compiled: {
    files: { path: string; content: string }[];
  }): Promise<{ html: string } | null>;
};

export type ArchitectRequestClass =
  | {
      kind: 'presentation';
      instruction: string;
      intent: 'date-range' | 'comparison-drawer' | 'density' | 'arrangement' | 'layout';
    }
  | { kind: 'sensitive'; reason: string }
  | { kind: 'empty'; reason: string };

const presentationIntents = [
  { intent: 'date-range' as const, pattern: /\bdate[- ]?range\b/i },
  { intent: 'comparison-drawer' as const, pattern: /\bcomparison|drawer\b/i },
  { intent: 'density' as const, pattern: /\bdensity|compact|comfortable\b/i },
  { intent: 'arrangement' as const, pattern: /\barrangement|timeline|markers|sequence\b/i },
  { intent: 'layout' as const, pattern: /\blayout|typography|spacing|appearance\b/i },
];

const sensitiveSignals = [
  /\b(ldl|hdl|tsh|glucose|hemoglobin|a1c|creatinine|cholesterol)\b/i,
  /\b(diagnos|treat|dos(e|ing)|prescrib|therap|patholog)\b/i,
  /\b(mg\/dl|mmol\/l|miu\/l|ng\/ml|pg\/ml)\b/i,
  /\b(ssn|mrn|patient|medical record|my (blood|lab|result|record)s?)\b/i,
  /\b\d+(\.\d+)?\s*(mg|mmol|iu|ng|pg)\b/i,
];

export function classifyArchitectRequest(instruction: string): ArchitectRequestClass {
  const value = instruction.trim();
  if (!value)
    return { kind: 'empty', reason: 'Write what should change about layout or appearance.' };
  if (sensitiveSignals.some((pattern) => pattern.test(value)))
    return {
      kind: 'sensitive',
      reason:
        'This request includes personal or clinical content. Health keeps that on the trusted host and does not send it to Architect.',
    };
  const matched = presentationIntents.find((item) => item.pattern.test(value));
  if (!matched)
    return {
      kind: 'sensitive',
      reason:
        'Only presentation and layout changes can be compiled. Clinical rules, records and values stay in Health.',
    };
  return { kind: 'presentation', instruction: value.slice(0, 2000), intent: matched.intent };
}

export function sanitizeArchitectBrief(input: {
  instruction: string;
  title?: string;
  notes?: string;
}) {
  const classified = classifyArchitectRequest(input.instruction);
  return {
    contract: healthArchitectContract,
    instruction: classified.kind === 'presentation' ? classified.instruction : '',
    classified: classified.kind,
    titleIncluded: false,
    notesIncluded: false,
    personalRecordsIncluded: false,
    syntheticExampleOnly: true,
    source: [
      ...healthApprovedSource.map((file) => ({ path: file.path, content: file.content })),
      {
        path: 'src/contract.json',
        content: `${JSON.stringify(healthArchitectContract, null, 2)}\n`,
      },
    ],
    syntheticExample: healthSyntheticExample,
    reason: classified.kind === 'presentation' ? null : classified.reason,
  };
}

export function architectUnavailableMessage() {
  return 'Customization compile is not available in this environment. Appearance and layout controls still work. A preview that did not compile in isolation is not a working customization.';
}

export function architectDiagnostics() {
  return {
    pr: ARCHITECT_APPS_DEPENDENCY.pr,
    branch: ARCHITECT_APPS_DEPENDENCY.branch,
    commit: ARCHITECT_APPS_DEPENDENCY.commit,
    inspectedAt: ARCHITECT_APPS_DEPENDENCY.inspectedAt,
    requires: [
      'Architect Apps HTTP routes',
      'ARCHITECT_ORIGIN_ENABLED and ARCHITECT_APPS_ENABLED',
      'Isolated Docker compile (host-fixture is not success)',
      'A usable preview document',
      'Server-bound source, artifact and isolation receipt',
    ],
  };
}

/** Development diagnostics only. Do not place this on ordinary member surfaces. */
export function architectBlockedMessage() {
  const info = architectDiagnostics();
  return `${architectUnavailableMessage()} Dependency: Architect Apps PR #${info.pr} ${info.commit}.`;
}

export function attemptIsVerified(attempt: ArchitectAttempt) {
  return (
    (attempt.status === 'ready' || attempt.status === 'accepted') &&
    attempt.isolation === 'docker' &&
    attempt.previewOk &&
    Boolean(attempt.sourceHash) &&
    Boolean(attempt.artifactHash) &&
    attempt.verified
  );
}

export async function probeArchitectAppsRuntime(
  fetchImpl: typeof fetch = fetch,
): Promise<{ status: ArchitectRuntimeStatus; blocker: string | null; httpStatus?: number }> {
  try {
    const response = await fetchImpl('/api/architect-apps', {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    if (response.status === 404)
      return { status: 'blocked', blocker: architectUnavailableMessage(), httpStatus: 404 };
    if (response.status === 401 || response.status === 200 || response.status === 503)
      return { status: 'available', blocker: null, httpStatus: response.status };
    return {
      status: 'blocked',
      blocker: architectUnavailableMessage(),
      httpStatus: response.status,
    };
  } catch {
    return { status: 'blocked', blocker: architectUnavailableMessage() };
  }
}

export const trustedPresentationSchema = z
  .object({
    density: z.enum(['comfortable', 'compact']),
    arrangement: z.enum(['sequence', 'timeline', 'markers']),
    dateRange: z.boolean(),
    comparisonDrawer: z.boolean(),
    accent: z.enum(['quiet', 'emerald']),
  })
  .strict();
export type TrustedPresentation = z.infer<typeof trustedPresentationSchema>;

export const defaultPresentation = (
  foundation: 'evening-routine' | 'bloodwork-tracker',
): TrustedPresentation => ({
  density: 'comfortable',
  arrangement: foundation === 'bloodwork-tracker' ? 'timeline' : 'sequence',
  dateRange: foundation === 'bloodwork-tracker',
  comparisonDrawer: foundation === 'bloodwork-tracker',
  accent: 'quiet',
});

export function exampleArchitectDiff(presentation: TrustedPresentation): ArchitectAttempt['diff'] {
  return [
    {
      path: 'src/DateRange.tsx',
      before: presentation.dateRange ? 'date range enabled' : 'date range hidden',
      after: 'interactive from/to controls bound to host-filtered observations',
    },
    {
      path: 'src/ComparisonDrawer.tsx',
      before: presentation.comparisonDrawer ? 'drawer enabled' : 'drawer hidden',
      after: 'compact comparison drawer using host-computed compatible differences only',
    },
  ];
}

function hashPayload(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0').repeat(8);
}

export async function requestArchitectRevision(input: {
  workspaceId: string;
  workingRevision: number;
  instruction: string;
  presentation: TrustedPresentation;
  runtime?: ArchitectAppsRuntime | null;
  now?: string;
  id?: string;
}): Promise<ArchitectAttempt> {
  const at = input.now ?? new Date().toISOString();
  const attemptedRevision = input.workingRevision + 1;
  const classified = classifyArchitectRequest(input.instruction);
  const sanitized = sanitizeArchitectBrief({ instruction: input.instruction });
  const base: ArchitectAttempt = {
    id: input.id ?? crypto.randomUUID(),
    workspaceId: input.workspaceId,
    instruction: sanitized.instruction || input.instruction.slice(0, 2000),
    status: 'blocked',
    workingRevision: input.workingRevision,
    attemptedRevision,
    diff: exampleArchitectDiff(input.presentation),
    stages: [
      {
        kind: 'proposed',
        at,
        detail: 'Structured Health contract prepared. Personal records were not attached.',
      },
    ],
    blocker: null,
    isolation: null,
    sourceHash: hashPayload(JSON.stringify(sanitized.source)),
    artifactHash: null,
    previewOk: false,
    verified: false,
  };
  if (classified.kind !== 'presentation') {
    return {
      ...base,
      status: 'failed',
      blocker: classified.reason,
      stages: [...base.stages, { kind: 'failed', at, detail: classified.reason }],
    };
  }
  if (!input.runtime) {
    return {
      ...base,
      status: 'blocked',
      isolation: 'unavailable',
      blocker: architectUnavailableMessage(),
      stages: [...base.stages, { kind: 'blocked', at, detail: architectUnavailableMessage() }],
    };
  }
  try {
    const proposal = await input.runtime.propose({
      workspaceId: input.workspaceId,
      instruction: classified.instruction,
      contract: healthArchitectContract,
      source: sanitized.source,
      syntheticExample: healthSyntheticExample,
    });
    const compiled = await input.runtime.compile({ files: proposal.files });
    if (!compiled.ok || compiled.isolation !== 'docker') {
      const detail =
        compiled.isolation !== 'docker'
          ? 'Isolation was unavailable. Host compilation cannot mark a Health customization as ready.'
          : compiled.log || 'Compilation failed. The last working version remains in use.';
      return {
        ...base,
        status: 'failed',
        isolation: compiled.isolation,
        diff: proposal.diff,
        blocker: detail,
        stages: [...base.stages, { kind: 'failed', at, detail }],
      };
    }
    const preview = await input.runtime.preview({ files: proposal.files });
    if (!preview?.html?.trim()) {
      return {
        ...base,
        status: 'failed',
        isolation: compiled.isolation,
        diff: proposal.diff,
        blocker: 'Compile produced no usable preview. The last working version remains in use.',
        stages: [
          ...base.stages,
          {
            kind: 'failed',
            at,
            detail: 'Compile produced no usable preview. The last working version remains in use.',
          },
        ],
      };
    }
    return {
      ...base,
      status: 'ready',
      isolation: 'docker',
      previewOk: true,
      verified: false,
      artifactHash: hashPayload(JSON.stringify(proposal.files)),
      diff: proposal.diff,
      stages: [
        ...base.stages,
        {
          kind: 'compiled',
          at,
          detail: compiled.receipt || 'Isolated Docker compile succeeded.',
        },
        {
          kind: 'preview',
          at,
          detail: 'Isolated preview is running. Accept to replace the working revision.',
        },
      ],
    };
  } catch (error) {
    return {
      ...base,
      status: 'failed',
      isolation: 'unavailable',
      blocker: error instanceof Error ? error.message : 'Architect request failed.',
      stages: [
        ...base.stages,
        {
          kind: 'failed',
          at,
          detail: 'The working version was kept. This was not recorded as an accepted revision.',
        },
      ],
    };
  }
}

export function acceptArchitectAttempt(attempt: ArchitectAttempt): ArchitectAttempt {
  if (attempt.status !== 'ready' || attempt.isolation !== 'docker' || !attempt.previewOk)
    return { ...attempt, verified: false };
  return {
    ...attempt,
    status: 'accepted',
    workingRevision: attempt.attemptedRevision,
    verified: true,
    stages: [
      ...attempt.stages,
      {
        kind: 'accepted',
        at: new Date().toISOString(),
        detail: `Revision ${attempt.attemptedRevision} is now working. Records and accepted settings were preserved.`,
      },
    ],
  };
}

export function restoreWorkingAttempt(attempt: ArchitectAttempt): ArchitectAttempt {
  return {
    ...attempt,
    status: attempt.status === 'accepted' ? 'accepted' : 'failed',
    workingRevision: attempt.workingRevision,
    verified: attempt.status === 'accepted' && attempt.verified,
    stages: [
      ...attempt.stages,
      {
        kind: 'restored',
        at: new Date().toISOString(),
        detail: `Working revision ${attempt.workingRevision} retained.`,
      },
    ],
  };
}

export function clientAttemptIsNotVerified(attempt: ArchitectAttempt | null) {
  if (!attempt) return true;
  return !attempt.verified || attempt.status !== 'accepted' || attempt.isolation !== 'docker';
}
