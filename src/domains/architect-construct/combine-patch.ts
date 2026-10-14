import { validateExistingFilePatches, type PatchFile } from './patch-contract';

export function applyWholeFilePatch(
  files: { path: string; content: string }[],
  patch: PatchFile[],
): { path: string; content: string }[] {
  const next = new Map(files.map((file) => [file.path, file.content]));
  for (const file of patch) {
    if (next.get(file.path) !== file.before)
      throw new Error(`Cannot apply ${file.path}: before-text does not match the current snapshot.`);
    next.set(file.path, file.after);
  }
  return files.map((file) => ({ path: file.path, content: next.get(file.path) ?? file.content }));
}

/** Combined repair patch always uses original pinned source as `before`. */
export function combineRepairPatch(input: {
  sourceFiles: { path: string; content: string }[];
  originalPatch: PatchFile[];
  repairPatch: PatchFile[];
  allowedPaths: string[];
  protectedPaths: string[];
}) {
  const afterOriginal = applyWholeFilePatch(input.sourceFiles, input.originalPatch);
  const afterRepair = applyWholeFilePatch(afterOriginal, input.repairPatch);
  const originals = new Map(input.sourceFiles.map((file) => [file.path, file.content]));
  const combined: PatchFile[] = [];
  for (const file of afterRepair) {
    const before = originals.get(file.path);
    if (before === undefined || before === file.content) continue;
    combined.push({ path: file.path, before, after: file.content });
  }
  if (!combined.length)
    return {
      ok: false as const,
      code: 'empty-proposal' as const,
      message: 'The proposed repair does not change the original pinned source.',
      actionable: 'A repair must produce a different complete file than the original snapshot.',
    };
  return validateExistingFilePatches({
    files: input.sourceFiles,
    patch: combined,
    allowedPaths: input.allowedPaths,
    protectedPaths: input.protectedPaths,
    editablePaths: input.sourceFiles.map((file) => file.path),
  });
}
