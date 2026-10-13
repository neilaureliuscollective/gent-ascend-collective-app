/**
 * Architect workbench preview contract.
 *
 * Consumes Origin documents and, when present, the Construct execution
 * preview shape from PR #116 (`result.preview.body` + source/result hashes).
 * This module does not start runs, store artifacts or invent a runtime URL.
 */
export const PREVIEW_BODY_MAX = 32768;
export const PREVIEW_HASH = /^[0-9a-f]{64}$/;
export const PREVIEW_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const CONSTRUCT_RUN_STATUSES = [
  'queued',
  'claimed',
  'running',
  'succeeded',
  'failed',
  'cancelled',
  'blocked',
  'timed_out',
] as const;
export type ConstructRunStatus = (typeof CONSTRUCT_RUN_STATUSES)[number];

export const CONSTRUCT_ISOLATION = ['docker', 'process-fixture', 'unavailable'] as const;
export type ConstructIsolation = (typeof CONSTRUCT_ISOLATION)[number];

export type PreviewKind = 'static-html' | 'markdown-document' | 'construct-html' | 'unavailable';
export type PreviewProvenance =
  | 'saved-document'
  | 'unsaved-draft'
  | 'construct'
  | 'construct-fixture'
  | 'current-run'
  | 'last-successful-revision'
  | 'demonstration';

export type PreviewIdentity = {
  projectId: string;
  ownerId: string | null;
  revision: number;
  artifactId: string | null;
  sourceHash: string | null;
  resultHash: string | null;
  persisted: boolean;
};

export type TrustedPreview = {
  kind: Exclude<PreviewKind, 'unavailable'>;
  identity: PreviewIdentity;
  srcDoc: string | null;
  markdown: string | null;
  path: string | null;
  labelledDemonstration: boolean;
  provenance: PreviewProvenance;
};

export type PreviewRejection = {
  kind: 'unavailable';
  reason: string;
  identity: PreviewIdentity | null;
};

export type PreviewDecision = TrustedPreview | PreviewRejection;

export type ConstructPreviewShape = {
  path: string | null;
  body: string;
  unavailable_reason: string | null;
};

const blockedUrl = /^(javascript|data|file|blob|vbscript):/i;

/** Isolated iframe flags. Never combine allow-scripts with allow-same-origin. */
export const PREVIEW_SANDBOX = '';

export function isPreviewHash(value: string | null | undefined): value is string {
  return !!value && PREVIEW_HASH.test(value);
}

export function isPreviewUuid(value: string | null | undefined): value is string {
  return !!value && (PREVIEW_UUID.test(value) || value === 'owner');
}

export function looksLikeHtml(content: string): boolean {
  const trimmed = content.trim();
  return /^<!DOCTYPE html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed);
}

export function rejectPreviewUrl(
  url: string,
  allowedOrigins: readonly string[] = [],
): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password) return 'Preview URLs cannot carry credentials.';
    if (blockedUrl.test(parsed.protocol)) return 'Preview URLs cannot use scriptable protocols.';
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')
      return 'Preview URLs must be HTTP(S).';
    if (!allowedOrigins.length) return 'No isolated preview origin is configured.';
    if (!allowedOrigins.includes(parsed.origin)) return 'Preview URL is not on a trusted origin.';
    return null;
  } catch {
    return 'Preview URL is not valid.';
  }
}

export function bindPreviewIdentity(input: {
  projectId: string;
  ownerId?: string | null;
  revision: number;
  artifactId?: string | null;
  sourceHash?: string | null;
  resultHash?: string | null;
  persisted?: boolean;
}): PreviewIdentity | null {
  if (!PREVIEW_UUID.test(input.projectId)) return null;
  if (input.ownerId && !isPreviewUuid(input.ownerId)) return null;
  if (!Number.isInteger(input.revision) || input.revision < 1 || input.revision > 500) return null;
  if (input.artifactId && !isPreviewUuid(input.artifactId) && !PREVIEW_UUID.test(input.artifactId))
    return null;
  if (input.sourceHash && !isPreviewHash(input.sourceHash)) return null;
  if (input.resultHash && !isPreviewHash(input.resultHash)) return null;
  return {
    projectId: input.projectId,
    ownerId: input.ownerId ?? null,
    revision: input.revision,
    artifactId: input.artifactId ?? null,
    sourceHash: input.sourceHash ?? null,
    resultHash: input.resultHash ?? null,
    persisted: input.persisted !== false,
  };
}

export function samePreviewOwnerProject(
  decision: PreviewDecision | null | undefined,
  projectId: string | null | undefined,
  ownerId: string | null | undefined,
): boolean {
  if (!decision || decision.kind === 'unavailable' || !projectId) return false;
  if (decision.identity.projectId !== projectId) return false;
  return decision.identity.ownerId === (ownerId ?? null);
}

/** Last successful Construct output is kept only for the same owner and project. */
export function retainHeldPreview(
  held: PreviewDecision | null | undefined,
  projectId: string | null | undefined,
  ownerId: string | null | undefined,
): PreviewDecision | null {
  if (!samePreviewOwnerProject(held, projectId, ownerId)) return null;
  return held ?? null;
}

export function previewCaption(
  decision: PreviewDecision,
  options: { stale?: boolean } = {},
): string {
  if (decision.kind === 'unavailable') return decision.reason;
  const parts: string[] = [];
  if (decision.provenance === 'demonstration' || decision.labelledDemonstration) {
    parts.push('Labelled demonstration — not a live generated preview.');
  } else if (decision.provenance === 'unsaved-draft') {
    parts.push('Unsaved draft preview. This is not a saved revision and not a running website.');
    parts.push(`Based on saved revision ${decision.identity.revision}`);
  } else if (decision.provenance === 'construct-fixture') {
    parts.push('Labelled fixture test output — not an isolated AI build and not a running website.');
    parts.push(`Revision ${decision.identity.revision}`);
  } else if (decision.provenance === 'current-run') {
    parts.push('Current Construct run output for this project. Isolated static preview only.');
    parts.push(`Revision ${decision.identity.revision}`);
  } else if (decision.provenance === 'last-successful-revision') {
    parts.push('Last successful Construct revision for this same project.');
    parts.push(`Revision ${decision.identity.revision}`);
  } else if (decision.provenance === 'saved-document' || decision.kind === 'markdown-document') {
    parts.push('Actual saved document. This is not a running website.');
    parts.push(`Revision ${decision.identity.revision}`);
  } else {
    parts.push('Isolated static preview of the current artifact. This is not a running website.');
    parts.push(`Revision ${decision.identity.revision}`);
  }
  if (decision.identity.resultHash)
    parts.push(`result ${decision.identity.resultHash.slice(0, 8)}`);
  if (options.stale) parts.push('last working revision shown');
  return parts.join(' · ');
}

export function decideConstructPreview(input: {
  identity: PreviewIdentity;
  preview: ConstructPreviewShape | null | undefined;
  ownerMatches: boolean;
  projectMatches: boolean;
  labelledDemonstration?: boolean;
  isolation?: ConstructIsolation | null;
  staleSuccess?: boolean;
}): PreviewDecision {
  if (!input.ownerMatches) {
    return {
      kind: 'unavailable',
      reason: 'Preview is bound to another owner.',
      identity: input.identity,
    };
  }
  if (!input.projectMatches) {
    return {
      kind: 'unavailable',
      reason: 'Preview is bound to a different project.',
      identity: input.identity,
    };
  }
  if (!input.preview) {
    return {
      kind: 'unavailable',
      reason: 'No Construct preview is attached.',
      identity: input.identity,
    };
  }
  if (input.preview.unavailable_reason) {
    return {
      kind: 'unavailable',
      reason: input.preview.unavailable_reason,
      identity: input.identity,
    };
  }
  if (!input.preview.body.trim()) {
    return {
      kind: 'unavailable',
      reason: 'Construct preview body is empty.',
      identity: input.identity,
    };
  }
  if (input.preview.body.length > PREVIEW_BODY_MAX) {
    return {
      kind: 'unavailable',
      reason: 'Construct preview exceeds the isolated body limit.',
      identity: input.identity,
    };
  }
  const fixture = input.isolation === 'process-fixture';
  return {
    kind: 'construct-html',
    identity: input.identity,
    srcDoc: input.preview.body,
    markdown: null,
    path: input.preview.path,
    labelledDemonstration: !!input.labelledDemonstration,
    provenance: fixture
      ? 'construct-fixture'
      : input.staleSuccess
        ? 'last-successful-revision'
        : 'construct',
  };
}
