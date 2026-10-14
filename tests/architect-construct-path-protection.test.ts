import { describe, expect, it } from 'vitest';
import {
  effectiveProtectedPaths,
  isProtectedSourcePath,
  isSafeRelPath,
} from '@/domains/architect-construct/path-protection';
import { defaultProtectedPaths } from '@/domains/architect-construct/schema';
import {
  assembleProviderPrompt,
  prepareSourceContext,
  providerPromptText,
} from '@/domains/architect-construct/source-context';

const SENTINEL = 'SYNTHETIC_PROTECTED_SENTINEL_DO_NOT_SHIP';
const APP = "export const heading = 'Before';\n";

function files(items: Array<[string, string]>) {
  return items.map(([path, content]) => ({ path, content }));
}

function contextFor(items: Array<[string, string]>, allowed = items.map(([path]) => path)) {
  return prepareSourceContext({
    files: files(items),
    allowedPaths: allowed,
    protectedPaths: [],
    intendedChange: 'Replace Before with After.',
  });
}

function promptContains(context: ReturnType<typeof prepareSourceContext>, value: string) {
  return providerPromptText(context).includes(value) || JSON.stringify(assembleProviderPrompt(context)).includes(value);
}

describe('shared path protection for context and edits', () => {
  it('treats root and nested environment files, keys, certificates and secret directories as protected', () => {
    const cases = [
      '.env',
      '.env.local',
      '.env.development.local',
      'config/.env',
      'apps/web/.env.production',
      'certs/server.pem',
      'keys/id_rsa.key',
      '.git/config',
      'secrets/token',
      'src/secrets/api.txt',
    ];
    for (const path of cases) {
      expect(isProtectedSourcePath(path, [])).toBe(true);
    }
    expect(isProtectedSourcePath('preview.html', [])).toBe(false);
    expect(isProtectedSourcePath('src/app.js', [])).toBe(false);
  });

  it('treats malicious path forms as protected without requiring supplied prefixes', () => {
    for (const path of ['../.env', '/etc/passwd', 'foo/../../.env', 'C:\\secrets\\key', 'foo//bar']) {
      expect(isSafeRelPath(path)).toBe(false);
      expect(isProtectedSourcePath(path, [])).toBe(true);
    }
  });

  it('keeps supplied prefixes such as credentials.json aligned with execution defaults', () => {
    expect(isProtectedSourcePath('credentials.json', [])).toBe(false);
    expect(isProtectedSourcePath('credentials.json', defaultProtectedPaths())).toBe(true);
    expect(effectiveProtectedPaths([])).toEqual(defaultProtectedPaths());
    expect(effectiveProtectedPaths(['notes.md'])).toContain('notes.md');
  });

  it('never puts protected imported or referenced contents into the assembled provider request', () => {
    const context = contextFor([
      ['app.js', `import secret from './.env.local';\n${APP}`],
      ['.env.local', `OPENAI_API_KEY=${SENTINEL}`],
      ['nested/.env', `SECRET=${SENTINEL}`],
      ['certs/server.pem', `-----BEGIN CERTIFICATE-----\n${SENTINEL}\n`],
      ['keys/id_rsa.key', `-----BEGIN PRIVATE KEY-----\n${SENTINEL}\n`],
      ['secrets/token', SENTINEL],
      ['.git/config', `[core]\n  sentinel = ${SENTINEL}\n`],
      ['preview.html', '<h1>Before</h1>\n'],
    ]);
    expect(context.editable.map((file) => file.path).sort()).toEqual(['app.js', 'preview.html']);
    expect(context.excluded.map((item) => item.path)).toEqual(
      expect.arrayContaining(['.env.local', 'nested/.env', 'certs/server.pem', 'keys/id_rsa.key', 'secrets/token', '.git/config']),
    );
    expect(context.entries.filter((entry) => entry.path === '.env.local')[0]).toMatchObject({
      inclusion: 'omitted',
      excerpt: null,
      bytes: 0,
      content_hash: null,
    });
    expect(promptContains(context, SENTINEL)).toBe(false);
    expect(assembleProviderPrompt(context).files.map((file) => file.path)).toEqual(
      expect.arrayContaining(['app.js', 'preview.html']),
    );
    expect(assembleProviderPrompt(context).manifest.map((entry) => entry.path)).not.toEqual(
      expect.arrayContaining(['.env.local', 'nested/.env', 'certs/server.pem']),
    );
  });

  it('does not let an allowlist or imported read-only reference authorize protected content', () => {
    const context = prepareSourceContext({
      files: files([
        ['app.js', `import env from './.env.local';\n${APP}`],
        ['.env.local', `TOKEN=${SENTINEL}`],
        ['notes.md', '# Authorized note\n'],
      ]),
      allowedPaths: ['app.js', '.env.local', 'notes.md'],
      protectedPaths: [],
      intendedChange: 'Keep the export.',
    });
    expect(context.editable.map((file) => file.path)).toEqual(['app.js', 'notes.md']);
    expect(context.editable.some((file) => file.path === '.env.local')).toBe(false);
    expect(context.provider_files.some((file) => file.path === '.env.local' || file.content.includes(SENTINEL))).toBe(
      false,
    );
    expect(promptContains(context, SENTINEL)).toBe(false);
    expect(context.excluded.some((item) => item.path === '.env.local')).toBe(true);
  });

  it('still includes legitimate complete source in the provider request', () => {
    const context = contextFor([['app.js', APP]]);
    expect(context.editable).toEqual([{ path: 'app.js', content: APP }]);
    expect(promptContains(context, 'export const heading')).toBe(true);
    expect(context.refusal).toBeNull();
  });
});
