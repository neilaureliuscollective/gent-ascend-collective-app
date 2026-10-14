import { mkdtemp, symlink, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PathGuardError,
  assertNoSymlink,
  assertWritable,
  isAllowedPath,
  isProtectedPath,
  resolveInside,
} from '@/domains/architect-construct/paths';
import { defaultProtectedPaths } from '@/domains/architect-construct/schema';
import { sanitizeLog, strippedEnv } from '@/domains/architect-construct/sanitize';

const scope = {
  allowed_paths: ['preview.html', 'src/app.ts'],
  protected_paths: defaultProtectedPaths(),
};

describe('Construct path and secret guards', () => {
  it('rejects traversal, absolute paths and unprotected writes', () => {
    expect(() => resolveInside('/tmp/work', '../etc/passwd')).toThrow(PathGuardError);
    expect(() => resolveInside('/tmp/work', '/etc/passwd')).toThrow(PathGuardError);
    expect(() => assertWritable('secrets/key', scope)).toThrow(/protected/);
    expect(() => assertWritable('.env', scope)).toThrow(/protected/);
    expect(() => assertWritable('src/../preview.html', scope)).toThrow(PathGuardError);
    expect(isAllowedPath('preview.html', scope.allowed_paths)).toBe(true);
    expect(isProtectedPath('credentials.json', [])).toBe(false);
    expect(isProtectedPath('credentials.json', defaultProtectedPaths())).toBe(true);
  });

  it('rejects symbolic links that escape the workspace', async () => {
    const root = await mkdtemp(join(tmpdir(), 'construct-symlink-'));
    try {
      await writeFile(join(root, 'preview.html'), 'ok');
      await symlink('/etc/passwd', join(root, 'src-app-link'));
      await expect(async () => {
        await writeFile(join(root, 'escaped'), 'x');
        await symlink(join(root, '..'), join(root, 'up'));
        assertNoSymlink(root, 'up');
      }).rejects.toThrow(PathGuardError);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('redacts secrets and refuses to pass host credentials into execution env', () => {
    expect(sanitizeLog('token sk-abc12345XYZ and Bearer supersecretvalue')).toContain('[redacted]');
    expect(sanitizeLog('OPENAI_API_KEY=abc', ['abc'])).toContain('[redacted]');
    const env = strippedEnv('/tmp/work');
    expect(env.OPENAI_API_KEY).toBeUndefined();
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    expect(env.ARCHITECT_CONSTRUCT_WORKER_TOKEN).toBeUndefined();
  });
});
