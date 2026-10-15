import { defaultProtectedPaths, relPath } from './schema';

export function isSafeRelPath(value: string) {
  return relPath.safeParse(value).success;
}

export function matchesPathPrefix(path: string, prefix: string) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function effectiveProtectedPaths(supplied: string[] = []) {
  return [...new Set([...defaultProtectedPaths(), ...supplied.filter(isSafeRelPath)])];
}

export function isProtectedSourcePath(path: string, protectedPaths: string[] = []) {
  if (!isSafeRelPath(path)) return true;
  const parts = path.split('/');
  if (
    path === '.env' ||
    path.startsWith('.env.') ||
    path.startsWith('.env/') ||
    path.includes('/.env') ||
    path.endsWith('.pem') ||
    path.endsWith('.key') ||
    matchesPathPrefix(path, '.git') ||
    parts.includes('.git') ||
    matchesPathPrefix(path, 'secrets') ||
    parts.includes('secrets')
  )
    return true;
  return protectedPaths.some((prefix) => isSafeRelPath(prefix) && matchesPathPrefix(path, prefix));
}
