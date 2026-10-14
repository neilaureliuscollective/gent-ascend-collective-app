import { isProtectedPath } from './paths';
import { relPath } from './schema';

export const patchRefusalCodes = [
  'create-unsupported',
  'delete-unsupported',
  'empty-is-not-delete',
  'stale-before',
  'truncated-before',
  'foreign-path',
  'protected-path',
  'duplicate-path',
  'overlapping-edit',
  'incomplete-output',
  'not-editable',
  'too-large',
  'empty-proposal',
  'malformed',
] as const;
export type PatchRefusalCode = (typeof patchRefusalCodes)[number];

export type PatchFile = { path: string; before: string; after: string };

export type PatchValidation =
  | { ok: true; patch: PatchFile[]; warnings: string[] }
  | { ok: false; code: PatchRefusalCode; message: string; actionable: string };

function refuse(code: PatchRefusalCode, message: string, actionable: string): PatchValidation {
  return { ok: false, code, message, actionable };
}

export function isTruncatedStandIn(before: string, original: string) {
  if (before === original) return false;
  if (!before.length || before.length >= original.length) return false;
  return original.startsWith(before) || original.includes(before.slice(0, Math.min(before.length, 80)));
}

export function validateExistingFilePatches(input: {
  files: { path: string; content: string }[];
  patch: PatchFile[];
  allowedPaths: string[];
  protectedPaths: string[];
  editablePaths?: Iterable<string>;
  truncatedPaths?: Iterable<string>;
}): PatchValidation {
  if (!Array.isArray(input.patch) || !input.patch.length)
    return refuse(
      'empty-proposal',
      'No complete patch was proposed.',
      'Describe a change to an authorized existing file that fits the whole-file budget, then propose again. An empty proposal is not success.',
    );

  const originals = new Map(input.files.map((file) => [file.path, file.content]));
  const editable = input.editablePaths ? new Set(input.editablePaths) : new Set(originals.keys());
  const truncated = new Set(input.truncatedPaths ?? []);
  const seen = new Set<string>();
  const warnings: string[] = [];
  const patch: PatchFile[] = [];

  for (const file of input.patch) {
    if (!file || typeof file.path !== 'string' || typeof file.before !== 'string' || typeof file.after !== 'string')
      return refuse(
        'malformed',
        'A patch entry is missing path, before, or after text.',
        'Return a complete schema-valid before/after object for each existing file.',
      );
    const parsed = relPath.safeParse(file.path);
    if (!parsed.success)
      return refuse(
        'foreign-path',
        `Path ${file.path} is not a safe workspace-relative file.`,
        'Keep every path inside the authorized snapshot. Foreign or climbing paths are rejected.',
      );
    const path = parsed.data;
    if (seen.has(path))
      return refuse(
        'duplicate-path',
        `Duplicate edits target ${path}.`,
        'Send one complete before/after for each file. Overlapping replacements are rejected.',
      );
    seen.add(path);
    if (!input.allowedPaths.includes(path))
      return refuse(
        'foreign-path',
        `${path} is outside the approved allowlist.`,
        'Add the file through the authorized source path or remove it from the patch.',
      );
    if (isProtectedPath(path, input.protectedPaths))
      return refuse(
        'protected-path',
        `${path} is protected and cannot be changed.`,
        'Choose a different authorized file. Secrets and credentials stay out of this pass.',
      );
    if (!originals.has(path)) {
      if (file.before === '')
        return refuse(
          'create-unsupported',
          `Creating ${path} is not supported in this pass.`,
          'This scoped capability edits existing files only. It is not a universal app generator. Add the file yourself, then propose an edit.',
        );
      return refuse(
        'create-unsupported',
        `${path} is not in the authorized snapshot, so this would create a file.`,
        'Creating files is explicitly unsupported. Import the existing file first or narrow the change to files already present.',
      );
    }
    if (truncated.has(path))
      return refuse(
        'truncated-before',
        `${path} was available only as an excerpt. An excerpt cannot stand in for the full original.`,
        'Select a smaller file, remove other complete files to free budget, or mark this path unsupported.',
      );
    if (!editable.has(path))
      return refuse(
        'not-editable',
        `${path} is not in the complete editable set for this proposal.`,
        'Inspect What Architect understands and include this complete file before approval.',
      );
    const original = originals.get(path)!;
    if (file.before !== original) {
      if (isTruncatedStandIn(file.before, original))
        return refuse(
          'truncated-before',
          `The proposed before-text for ${path} is a truncated stand-in, not the exact original.`,
          'Whole-file patches require the complete current content. Do not approve this candidate.',
        );
      return refuse(
        'stale-before',
        `The before-text for ${path} does not match the authorized source hash and content.`,
        'Reload the exact snapshot and propose again. Changing source invalidates this candidate.',
      );
    }
    if (file.after === '' && original !== '') {
      warnings.push(
        `${path} would be emptied. Empty replacement content is not deletion; the file remains. Actual deletion is unsupported.`,
      );
    }
    patch.push({ path, before: file.before, after: file.after });
  }

  return { ok: true, patch, warnings };
}

export function creationOrDeletionMessage(kind: 'create' | 'delete') {
  if (kind === 'create')
    return 'Creating files is not supported in this pass. Architect edits existing authorized files only.';
  return 'Deleting files is not supported in this pass. Empty replacement content empties a file; it does not remove it.';
}
