export const SOURCE_CONTEXT_BUDGET = {
  maxInventoryFiles: 32,
  maxEditableFiles: 8,
  maxEditableFileBytes: 65536,
  maxEditableTotalBytes: 49152,
  maxExcerptFiles: 8,
  excerptChars: 2000,
  maxInstructionChars: 4000,
  maxOutputTokens: 8000,
  formerExcerptChars: 4000,
  formerFileCutoff: 8,
} as const;

export const sourceInclusions = ['complete', 'excerpt', 'too-large', 'missing', 'omitted'] as const;
export type SourceInclusion = (typeof sourceInclusions)[number];

export const sourceRoles = ['editable', 'instruction', 'related', 'missing-import', 'unsupported'] as const;
export type SourceRole = (typeof sourceRoles)[number];

export type SourceInventoryFile = { path: string; content: string };

export type SourceManifestEntry = {
  path: string;
  role: SourceRole;
  inclusion: SourceInclusion;
  bytes: number;
  content_hash: string | null;
  reason: string;
  excerpt: string | null;
  complete: boolean;
};

export type SourceContextManifest = {
  complete_repository: false;
  outcome: string;
  budget: typeof SOURCE_CONTEXT_BUDGET;
  entries: SourceManifestEntry[];
  editable: SourceInventoryFile[];
  provider_files: Array<SourceInventoryFile & { editable: boolean }>;
  missing: string[];
  refusal: string | null;
};

const instructionNames = new Set([
  'agents.md',
  'readme.md',
  'readme',
  'package.json',
  'tsconfig.json',
  'jsconfig.json',
  'vitest.config.ts',
  'vitest.config.mjs',
  'playwright.config.ts',
]);

export function utf8Bytes(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

export function isInstructionPath(path: string) {
  const base = path.split('/').pop()?.toLowerCase() ?? '';
  return instructionNames.has(base) || base.startsWith('.eslintrc');
}

export function excerptText(content: string, limit: number = SOURCE_CONTEXT_BUDGET.excerptChars) {
  if (content.length <= limit) return content;
  return `${content.slice(0, limit)}\n/* Architect excerpt — not the complete file. */\n`;
}

const importPattern = /(?:from\s+|import\s*\(|require\s*\()\s*['"]([^'"]+)['"]/g;

export function referencedSpecifiers(content: string) {
  return [...content.matchAll(importPattern)].flatMap((match) => (match[1] ? [match[1]] : []));
}

export function resolveRelativeSpecifier(fromPath: string, specifier: string) {
  if (!specifier.startsWith('.')) return null;
  const dir = fromPath.includes('/') ? fromPath.slice(0, fromPath.lastIndexOf('/')) : '';
  const parts = [...(dir ? dir.split('/') : []), ...specifier.split('/')];
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === '.' || part === '') continue;
    if (part === '..') resolved.pop();
    else resolved.push(part);
  }
  return resolved.join('/');
}

export function existingPathForSpecifier(
  specifier: string,
  files: Iterable<string>,
): string | null {
  const names = new Set(files);
  if (names.has(specifier)) return specifier;
  for (const ext of ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json']) {
    if (names.has(`${specifier}${ext}`)) return `${specifier}${ext}`;
  }
  if (names.has(`${specifier}/index.ts`)) return `${specifier}/index.ts`;
  if (names.has(`${specifier}/index.js`)) return `${specifier}/index.js`;
  if (names.has(`${specifier}/index.mjs`)) return `${specifier}/index.mjs`;
  return null;
}

function mentionsPath(intended: string, path: string) {
  const lower = intended.toLowerCase();
  return path.split('/').some((part) => part && lower.includes(part.toLowerCase()));
}

function editableScore(file: SourceInventoryFile, intendedChange: string, allowed: Set<string>) {
  let score = 0;
  if (allowed.has(file.path)) score += 8;
  if (mentionsPath(intendedChange, file.path)) score += 6;
  if (/\.(js|mjs|cjs|ts|tsx)$/.test(file.path)) score += 3;
  if (/\.(html|css|json|md)$/.test(file.path)) score += 1;
  if (isInstructionPath(file.path)) score -= 4;
  return score;
}

function hashOrNull(content: string, hash?: (value: string) => string) {
  return hash ? hash(content) : null;
}

export function prepareSourceContext(input: {
  files: SourceInventoryFile[];
  allowedPaths: string[];
  protectedPaths: string[];
  intendedChange: string;
  instruction?: string;
  hash?: (value: string) => string;
}): SourceContextManifest {
  const allowed = new Set(input.allowedPaths);
  const protectedPaths = input.protectedPaths;
  const byPath = new Map(input.files.map((file) => [file.path, file]));
  const missing = new Set<string>();
  const related = new Set<string>();

  for (const file of input.files) {
    for (const specifier of referencedSpecifiers(file.content)) {
      const relative = resolveRelativeSpecifier(file.path, specifier);
      if (!relative) continue;
      const existing = existingPathForSpecifier(relative, byPath.keys());
      if (existing) related.add(existing);
      else missing.add(relative);
    }
  }

  const ranked = [...input.files].sort(
    (a, b) =>
      editableScore(b, input.intendedChange, allowed) - editableScore(a, input.intendedChange, allowed) ||
      a.path.localeCompare(b.path),
  );

  const editable: SourceInventoryFile[] = [];
  let editableBytes = 0;
  const chosen = new Set<string>();
  const entries: SourceManifestEntry[] = [];

  const isProtected = (path: string) =>
    protectedPaths.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

  for (const file of ranked) {
    const bytes = utf8Bytes(file.content);
    if (isProtected(file.path)) {
      entries.push({
        path: file.path,
        role: 'unsupported',
        inclusion: 'omitted',
        bytes,
        content_hash: hashOrNull(file.content, input.hash),
        reason: 'Protected path. Architect will not send or edit this file.',
        excerpt: null,
        complete: false,
      });
      continue;
    }
    if (bytes > SOURCE_CONTEXT_BUDGET.maxEditableFileBytes) {
      entries.push({
        path: file.path,
        role: allowed.has(file.path) ? 'unsupported' : 'related',
        inclusion: 'too-large',
        bytes,
        content_hash: hashOrNull(file.content, input.hash),
        reason: `File is ${bytes} bytes and exceeds the ${SOURCE_CONTEXT_BUDGET.maxEditableFileBytes}-byte whole-file edit budget. Narrow the file or request a smaller scope. A truncated excerpt cannot stand in for this original.`,
        excerpt: excerptText(file.content),
        complete: false,
      });
      continue;
    }
    const nextTotal = editableBytes + bytes;
    const hasOtherEditable = ranked.some(
      (other) =>
        other.path !== file.path &&
        allowed.has(other.path) &&
        !isInstructionPath(other.path) &&
        !isProtected(other.path) &&
        utf8Bytes(other.content) <= SOURCE_CONTEXT_BUDGET.maxEditableFileBytes,
    );
    const canEdit =
      allowed.has(file.path) &&
      !(isInstructionPath(file.path) && hasOtherEditable) &&
      editable.length < SOURCE_CONTEXT_BUDGET.maxEditableFiles &&
      nextTotal <= SOURCE_CONTEXT_BUDGET.maxEditableTotalBytes;
    if (canEdit) {
      editable.push(file);
      editableBytes = nextTotal;
      chosen.add(file.path);
      entries.push({
        path: file.path,
        role: 'editable',
        inclusion: 'complete',
        bytes,
        content_hash: hashOrNull(file.content, input.hash),
        reason: 'Complete exact content is included so a whole-file before/after patch can match this revision.',
        excerpt: null,
        complete: true,
      });
      continue;
    }
    if (allowed.has(file.path) && !isInstructionPath(file.path)) {
      const overCount = editable.length >= SOURCE_CONTEXT_BUDGET.maxEditableFiles;
      entries.push({
        path: file.path,
        role: 'unsupported',
        inclusion: overCount ? 'omitted' : 'too-large',
        bytes,
        content_hash: hashOrNull(file.content, input.hash),
        reason: overCount
          ? `Relevant beyond the ${SOURCE_CONTEXT_BUDGET.maxEditableFiles}-file editable cutoff. Add it by removing another complete file first. This is not complete-repository understanding.`
          : `Including this complete file would exceed the ${SOURCE_CONTEXT_BUDGET.maxEditableTotalBytes}-byte editable budget. Request a smaller scope. A truncated excerpt cannot be used as the original.`,
        excerpt: excerptText(file.content),
        complete: false,
      });
      continue;
    }
    if (isInstructionPath(file.path) || related.has(file.path)) {
      entries.push({
        path: file.path,
        role: isInstructionPath(file.path) ? 'instruction' : 'related',
        inclusion: 'excerpt',
        bytes,
        content_hash: hashOrNull(file.content, input.hash),
        reason: isInstructionPath(file.path)
          ? 'Project instruction or toolchain file. Excerpt only — not an editable whole-file original.'
          : 'Related import or configuration. Excerpt only — not an editable whole-file original.',
        excerpt: excerptText(
          file.content,
          isInstructionPath(file.path)
            ? SOURCE_CONTEXT_BUDGET.maxInstructionChars
            : SOURCE_CONTEXT_BUDGET.excerptChars,
        ),
        complete: false,
      });
    }
  }

  for (const path of missing) {
    entries.push({
      path,
      role: 'missing-import',
      inclusion: 'missing',
      bytes: 0,
      content_hash: null,
      reason: 'Referenced by selected source and not present in the authorized snapshot. Add it through the existing authorized import path.',
      excerpt: null,
      complete: false,
    });
  }

  entries.sort((a, b) => a.path.localeCompare(b.path));
  const excerptEntries = entries.filter((entry) => entry.inclusion === 'excerpt').slice(0, SOURCE_CONTEXT_BUDGET.maxExcerptFiles);
  const excerptPaths = new Set(excerptEntries.map((entry) => entry.path));
  const provider_files = [
    ...editable.map((file) => ({ ...file, editable: true })),
    ...excerptEntries.flatMap((entry) => {
      const file = byPath.get(entry.path);
      if (!file || !entry.excerpt) return [];
      return [{ path: file.path, content: entry.excerpt, editable: false }];
    }),
  ];

  const omittedRelevant = entries.filter(
    (entry) =>
      entry.role === 'unsupported' &&
      (entry.inclusion === 'omitted' || entry.inclusion === 'too-large') &&
      allowed.has(entry.path),
  );
  const refusal =
    editable.length === 0
      ? omittedRelevant.some((entry) => entry.inclusion === 'too-large')
        ? 'No complete editable file fits the whole-file budget. Narrow the file or the requested change. Architect will not treat an excerpt as the original.'
        : 'No authorized complete file is available to edit. Add relevant source through the existing authorized path. Missing context is not a successful proposal.'
      : null;

  return {
    complete_repository: false,
    outcome: input.intendedChange.trim(),
    budget: SOURCE_CONTEXT_BUDGET,
    entries: entries.filter(
      (entry) =>
        entry.role === 'missing-import' ||
        entry.inclusion === 'complete' ||
        excerptPaths.has(entry.path) ||
        entry.inclusion === 'too-large' ||
        entry.inclusion === 'omitted',
    ),
    editable,
    provider_files,
    missing: [...missing].sort(),
    refusal,
  };
}

export function editablePathSet(context: SourceContextManifest) {
  return new Set(context.editable.map((file) => file.path));
}

export function truncatedPathSet(context: SourceContextManifest) {
  return new Set(
    context.entries
      .filter((entry) => entry.inclusion === 'excerpt' || entry.inclusion === 'too-large')
      .map((entry) => entry.path),
  );
}
