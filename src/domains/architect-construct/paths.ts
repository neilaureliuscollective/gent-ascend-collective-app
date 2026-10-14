import { lstatSync, realpathSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { relPath, type BriefScope } from './schema';

export class PathGuardError extends Error {
  constructor(message = 'Path is outside the approved execution scope.') {
    super(message);
  }
}

export function assertRelPath(value: string) {
  const parsed = relPath.safeParse(value);
  if (!parsed.success) throw new PathGuardError('Path is not a safe relative file.');
  return parsed.data;
}

export function matchesPrefix(path: string, prefix: string) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function isProtectedPath(path: string, protectedPaths: string[]) {
  const safe = assertRelPath(path);
  if (
    safe === '.env' ||
    safe.startsWith('.env.') ||
    safe.includes('/.env') ||
    safe.endsWith('.pem') ||
    safe.endsWith('.key') ||
    matchesPrefix(safe, '.git') ||
    matchesPrefix(safe, 'secrets')
  )
    return true;
  return protectedPaths.some((prefix) => matchesPrefix(safe, prefix));
}

export function isAllowedPath(path: string, allowedPaths: string[]) {
  const safe = assertRelPath(path);
  return allowedPaths.some((prefix) => matchesPrefix(safe, prefix));
}

export function assertWritable(path: string, scope: Pick<BriefScope, 'allowed_paths' | 'protected_paths'>) {
  const safe = assertRelPath(path);
  if (isProtectedPath(safe, scope.protected_paths))
    throw new PathGuardError('Path is protected and cannot be changed.');
  if (!isAllowedPath(safe, scope.allowed_paths))
    throw new PathGuardError('Path is not in the approved allowlist.');
  return safe;
}

export function resolveInside(root: string, rel: string) {
  const safe = assertRelPath(rel);
  const base = resolve(root);
  const target = resolve(join(base, safe));
  if (target !== base && !target.startsWith(base + sep))
    throw new PathGuardError('Resolved path escaped the workspace.');
  return target;
}

export function assertNoSymlink(root: string, rel: string) {
  const target = resolveInside(root, rel);
  try {
    if (lstatSync(target).isSymbolicLink()) throw new PathGuardError('Symbolic links are rejected.');
    const real = realpathSync(target);
    const base = realpathSync(root);
    if (real !== base && !real.startsWith(base + sep))
      throw new PathGuardError('Symbolic link escaped the workspace.');
  } catch (error) {
    if (error instanceof PathGuardError) throw error;
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return target;
    throw error;
  }
  return target;
}
