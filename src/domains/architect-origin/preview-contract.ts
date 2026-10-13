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

export type PreviewKind = 'static-html' | 'markdown-document' | 'construct-html' | 'unavailable';

export type PreviewIdentity = {
  projectId: string;
  ownerId: string | null;
  revision: number;
  sourceHash: string | null;
  resultHash: string | null;
};

export type TrustedPreview = {
  kind: Exclude<PreviewKind, 'unavailable'>;
  identity: PreviewIdentity;
  srcDoc: string | null;
  markdown: string | null;
  path: string | null;
  labelledDemonstration: boolean;
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
  sourceHash?: string | null;
  resultHash?: string | null;
}): PreviewIdentity | null {
  if (!PREVIEW_UUID.test(input.projectId)) return null;
  if (input.ownerId && !PREVIEW_UUID.test(input.ownerId) && input.ownerId !== 'owner') return null;
  if (!Number.isInteger(input.revision) || input.revision < 1 || input.revision > 500) return null;
  if (input.sourceHash && !isPreviewHash(input.sourceHash)) return null;
  if (input.resultHash && !isPreviewHash(input.resultHash)) return null;
  return {
    projectId: input.projectId,
    ownerId: input.ownerId ?? null,
    revision: input.revision,
    sourceHash: input.sourceHash ?? null,
    resultHash: input.resultHash ?? null,
  };
}

export function decideConstructPreview(input: {
  identity: PreviewIdentity;
  preview: ConstructPreviewShape | null | undefined;
  ownerMatches: boolean;
  projectMatches: boolean;
  labelledDemonstration?: boolean;
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
  return {
    kind: 'construct-html',
    identity: input.identity,
    srcDoc: input.preview.body,
    markdown: null,
    path: input.preview.path,
    labelledDemonstration: !!input.labelledDemonstration,
  };
}
