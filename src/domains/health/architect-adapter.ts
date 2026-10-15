import { z } from 'zod';

/** Exact unmerged Architect Apps runtime this Health phase depends on. Do not silently vendor the engine. */
export const ARCHITECT_APPS_DEPENDENCY = {
  pr: 130,
  branch: 'cursor/architect-create-apps-501f',
  commit: '9f858d1b5af4df710c4a01dd43668db7366f6626',
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
};

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
    isolation: 'docker' | 'unavailable';
  }>;
  preview(compiled: {
    files: { path: string; content: string }[];
  }): Promise<{ html: string } | null>;
};

const labLike =
  /\b(\d+(\.\d+)?\s*(mg\/dL|mmol\/L|mIU\/L|ng\/mL|pg\/mL)|LDL|HDL|TSH|glucose|hemoglobin)\b/gi;

export function sanitizeArchitectBrief(input: {
  instruction: string;
  title?: string;
  notes?: string;
}) {
  const instruction = input.instruction.replace(labLike, '[redacted]').slice(0, 2000);
  return {
    contract: healthArchitectContract,
    instruction,
    titleIncluded: false,
    notesIncluded: false,
    personalRecordsIncluded: false,
    syntheticExampleOnly: true,
  };
}

export function architectBlockedMessage() {
  return `Dynamic compilation is blocked until Architect Apps PR #${ARCHITECT_APPS_DEPENDENCY.pr} (${ARCHITECT_APPS_DEPENDENCY.commit}) is merged and enabled locally. Trusted appearance and workflow controls remain available. A mocked compile is not a running preview.`;
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
      return { status: 'blocked', blocker: architectBlockedMessage(), httpStatus: 404 };
    if (response.status === 401 || response.status === 200 || response.status === 503)
      return { status: 'available', blocker: null, httpStatus: response.status };
    return {
      status: 'blocked',
      blocker: architectBlockedMessage(),
      httpStatus: response.status,
    };
  } catch {
    return { status: 'blocked', blocker: architectBlockedMessage() };
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

export async function requestArchitectRevision(input: {
  workspaceId: string;
  workingRevision: number;
  instruction: string;
  presentation: TrustedPresentation;
  runtime?: ArchitectAppsRuntime | null;
  now?: string;
}): Promise<ArchitectAttempt> {
  const at = input.now ?? new Date().toISOString();
  const attemptedRevision = input.workingRevision + 1;
  const sanitized = sanitizeArchitectBrief({ instruction: input.instruction });
  const base: ArchitectAttempt = {
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    instruction: sanitized.instruction,
    status: 'blocked',
    workingRevision: input.workingRevision,
    attemptedRevision,
    diff: exampleArchitectDiff(input.presentation),
    stages: [
      {
        kind: 'proposed',
        at,
        detail: 'Sanitized Health contract prepared. Personal records were not attached.',
      },
    ],
    blocker: null,
  };
  if (!input.runtime) {
    return {
      ...base,
      status: 'blocked',
      blocker: architectBlockedMessage(),
      stages: [...base.stages, { kind: 'blocked', at, detail: architectBlockedMessage() }],
    };
  }
  try {
    const proposal = await input.runtime.propose({
      workspaceId: input.workspaceId,
      instruction: sanitized.instruction,
      contract: healthArchitectContract,
      source: base.diff.map((row) => ({ path: row.path, content: row.after })),
      syntheticExample: { foundation: 'bloodwork-tracker', sample: true },
    });
    const compiled = await input.runtime.compile({ files: proposal.files });
    if (!compiled.ok) {
      return {
        ...base,
        status: 'failed',
        diff: proposal.diff,
        blocker: compiled.log,
        stages: [
          ...base.stages,
          {
            kind: 'failed',
            at,
            detail: compiled.log || 'Compilation failed. The last working version remains in use.',
          },
        ],
      };
    }
    await input.runtime.preview({ files: proposal.files });
    return {
      ...base,
      status: 'ready',
      diff: proposal.diff,
      stages: [
        ...base.stages,
        { kind: 'compiled', at, detail: `Isolated ${compiled.isolation} compile succeeded.` },
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
  if (attempt.status !== 'ready') return attempt;
  return {
    ...attempt,
    status: 'accepted',
    workingRevision: attempt.attemptedRevision,
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
