import { describe, expect, it } from 'vitest';
import {
  assertRuntime,
  localScope,
  protectionHeaders,
  publicAcceptanceKey,
  stagingScope,
} from '../scripts/creation-acceptance-scope';
import { creationRuntime } from '@/domains/technology/runtime';
const tree = 'a'.repeat(40),
  commit = 'b'.repeat(40),
  now = Date.parse('2026-10-09T12:00:00Z');
function manifest() {
  return {
    contract: 'public-creation-acceptance-v1',
    scope: 'isolated-staging',
    candidateTree: tree,
    candidateCommit: commit,
    projectRef: 'abcdefghijklmnopqrst',
    deploymentOrigin: 'https://synthetic-candidate.vercel.app',
    expiresAt: '2026-10-09T13:00:00Z',
    syntheticWritesApproved: true,
    branchIdentityVerified: true,
    deploymentIdentityVerified: true,
    accounts: [
      {
        authUserId: '00000000-0000-4000-8000-000000000001',
        personId: '00000000-0000-4000-8000-000000000011',
      },
      {
        authUserId: '00000000-0000-4000-8000-000000000002',
        personId: '00000000-0000-4000-8000-000000000012',
      },
    ],
  };
}
describe('creation acceptance refuses unsafe scope before credentials or writes', () => {
  it('binds independent staging attestation to exact candidate and two identities', () => {
    expect(stagingScope(manifest(), tree, commit, now)).toMatchObject({
      scope: 'isolated-staging',
      projectRef: 'abcdefghijklmnopqrst',
      candidateTree: tree,
      candidateCommit: commit,
    });
  });
  it.each(['volpzkfsnmtztrovexcw', 'tybjocxecilkmozkvuns'])(
    'rejects protected database %s',
    (projectRef) => {
      expect(() => stagingScope({ ...manifest(), projectRef }, tree, commit, now)).toThrow();
    },
  );
  it.each([
    'https://gentascend.com',
    'https://gent-ascend-collective-qrnfjypec-stutes-legacy.vercel.app',
    'http://synthetic-candidate.vercel.app',
    'https://synthetic-candidate.vercel.app/path',
    'https://synthetic-candidate.vercel.app?token=x',
    'https://synthetic-candidate.vercel.app.evil.test',
    'https://user:password@synthetic-candidate.vercel.app',
    'https://synthetic-candidate.vercel.app:444',
  ])('rejects unbound deployment %s', (deploymentOrigin) => {
    expect(() => stagingScope({ ...manifest(), deploymentOrigin }, tree, commit, now)).toThrow();
  });
  it('rejects stale, overlong, dirty, unapproved and duplicated attestations', () => {
    const m = manifest();
    for (const patch of [
      { candidateTree: commit },
      { candidateCommit: tree },
      { expiresAt: '2026-10-09T11:00:00Z' },
      { expiresAt: '2026-10-11T12:00:00Z' },
      { syntheticWritesApproved: false },
      { branchIdentityVerified: false },
      { deploymentIdentityVerified: false },
      { unexpected: true },
      { accounts: [m.accounts[0], m.accounts[0]] },
    ])
      expect(() => stagingScope({ ...m, ...patch }, tree, commit, now)).toThrow();
  });
  it('allows only exact disposable loopback', () => {
    expect(localScope('http://127.0.0.1:54321', tree, commit).scope).toBe('disposable-local');
    for (const url of [
      'https://volpzkfsnmtztrovexcw.supabase.co',
      'http://127.0.0.1:54321/path',
      'http://localhost:54321',
    ])
      expect(() => localScope(url, tree, commit)).toThrow();
  });
  it('requires observed runtime commit, project, preview mode and disabled harness', () => {
    const scope = stagingScope(manifest(), tree, commit, now);
    const runtime = {
      contract: 'public-creation-runtime-v1',
      commit,
      projectRef: scope.projectRef,
      mode: 'preview',
      harnessEnabled: false,
    };
    expect(() => assertRuntime(runtime, scope)).not.toThrow();
    for (const patch of [
      { commit: tree },
      { projectRef: 'volpzkfsnmtztrovexcw' },
      { harnessEnabled: true },
      { mode: 'local' },
      { mode: 'production' },
      { secret: 'not-allowed' },
      { commit: null },
    ])
      expect(() => assertRuntime({ ...runtime, ...patch }, scope)).toThrow();
  });
  it('rejects administrative keys and scopes Vercel protection to the single origin', () => {
    expect(publicAcceptanceKey('sb_publishable_synthetic')).toBe('sb_publishable_synthetic');
    const jwt = (role: string) =>
      `e30.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.synthetic`;
    expect(publicAcceptanceKey(jwt('anon'))).toBe(jwt('anon'));
    for (const key of [
      jwt('service_role'),
      'sb_secret_synthetic',
      '',
      'sb_publishable_' + 'x'.repeat(5000),
    ])
      expect(() => publicAcceptanceKey(key)).toThrow();
    const origin = manifest().deploymentOrigin;
    expect(protectionHeaders(origin, origin + '/enter', 'synthetic-oidc')).toEqual({
      'x-vercel-trusted-oidc-idp-token': 'synthetic-oidc',
    });
    for (const target of [
      'https://abcdefghijklmnopqrst.supabase.co/auth/v1',
      'https://synthetic-candidate.vercel.app.evil.test',
      'http://synthetic-candidate.vercel.app',
    ])
      expect(protectionHeaders(origin, target, 'synthetic-oidc')).toEqual({});
    expect(protectionHeaders(origin, origin + '/enter')).toEqual({});
  });
});
describe('non-secret build binding', () => {
  const env = {
    APP_ENV: 'preview',
    VERCEL_ENV: 'preview',
    NEXT_PUBLIC_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic',
    CREATION_BUILD_COMMIT: commit,
  };
  it('exposes only preview deployment identity, never credentials', () => {
    expect(
      creationRuntime({
        ...env,
        OPENAI_API_KEY: 'synthetic-secret',
        SUPABASE_SERVICE_ROLE_KEY: 'synthetic-admin',
      }),
    ).toEqual({
      contract: 'public-creation-runtime-v1',
      mode: 'preview',
      projectRef: 'abcdefghijklmnopqrst',
      commit,
      harnessEnabled: false,
    });
  });
  it('is absent in production and refuses hosted harness configuration', () => {
    expect(creationRuntime({ ...env, APP_ENV: 'production', VERCEL_ENV: 'production' })).toBeNull();
    expect(() => creationRuntime({ ...env, AURELIUS_DEV_HARNESS: 'true' })).toThrow();
  });
  it('fails closed for unknown identity and malformed commit', () => {
    expect(
      creationRuntime({
        ...env,
        NEXT_PUBLIC_SUPABASE_URL: 'https://unknown.test',
        CREATION_BUILD_COMMIT: 'unknown',
      }),
    ).toMatchObject({ projectRef: null, commit: null });
  });
});
