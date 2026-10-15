import { isGeneratedAppPath, isSealedAppPath, sealedFiles } from './catalog';
import { fileHash, treeHash } from './hash';
import type { AppFile, FileOperation } from './schema';

export class AppTreeError extends Error {}

export function normalizeAppFiles(files: AppFile[]) {
  const unique = new Map<string, AppFile>();
  for (const file of files) {
    if (unique.has(file.path)) throw new AppTreeError(`Duplicate path ${file.path}.`);
    unique.set(file.path, file);
  }
  return [...unique.values()].sort((a, b) => a.path.localeCompare(b.path));
}

export function overlaySealedFiles(generated: AppFile[]): AppFile[] {
  const sealed = sealedFiles();
  const generatedOnly = generated.filter((file) => isGeneratedAppPath(file.path) && !isSealedAppPath(file.path));
  return normalizeAppFiles([...sealed, ...generatedOnly]);
}

export function assertGeneratedBudget(files: AppFile[], maxBytes = 400000) {
  const generated = files.filter((file) => isGeneratedAppPath(file.path));
  const bytes = generated.reduce((sum, file) => sum + new TextEncoder().encode(file.content).length, 0);
  if (generated.length > 40) throw new AppTreeError('Generated application exceeds the 40-file bound.');
  if (bytes > maxBytes) throw new AppTreeError('Generated application exceeds the 400 KB bound.');
}

export function applyFileOperations(base: AppFile[], operations: FileOperation[]) {
  const next = new Map(normalizeAppFiles(base).map((file) => [file.path, file]));
  for (const operation of operations) {
    if (!isGeneratedAppPath(operation.path) || isSealedAppPath(operation.path))
      throw new AppTreeError('Sealed toolchain files cannot be created, updated or deleted.');
    const current = next.get(operation.path);
    if (operation.op === 'create') {
      if (current) throw new AppTreeError(`Refusing to create ${operation.path}; the file already exists.`);
      next.set(operation.path, { path: operation.path, content: operation.content ?? '' });
      continue;
    }
    if (!current) throw new AppTreeError(`Refusing stale change to missing ${operation.path}.`);
    if (!operation.baseHash || fileHash(current.content) !== operation.baseHash)
      throw new AppTreeError(`Stale change rejected for ${operation.path}. Reload the exact base hash.`);
    if (operation.op === 'delete') {
      next.delete(operation.path);
      continue;
    }
    if (current.content === operation.content) continue;
    next.set(operation.path, { path: operation.path, content: operation.content ?? '' });
  }
  const files = overlaySealedFiles([...next.values()]);
  assertGeneratedBudget(files);
  return { files, treeHash: treeHash(files) };
}

export function diffAppFiles(before: AppFile[], after: AppFile[]) {
  const previous = new Map(before.map((file) => [file.path, file.content]));
  const next = new Map(after.map((file) => [file.path, file.content]));
  const paths = new Set([...previous.keys(), ...next.keys()]);
  const changes: { path: string; kind: 'create' | 'update' | 'delete' | 'unchanged' }[] = [];
  for (const path of [...paths].sort()) {
    const left = previous.get(path);
    const right = next.get(path);
    if (left == null && right != null) changes.push({ path, kind: 'create' });
    else if (left != null && right == null) changes.push({ path, kind: 'delete' });
    else if (left !== right) changes.push({ path, kind: 'update' });
    else changes.push({ path, kind: 'unchanged' });
  }
  return changes;
}
