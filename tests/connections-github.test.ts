import { describe, expect, it } from 'vitest';
import { ConnectionError } from '../src/domains/connections/errors';
import { memoryStore } from '../src/domains/connections/store';
import {
  completeGithubCallback,
  githubFlow,
  githubInstallationTokenFor,
  selectGithubRepository,
  verifyGithubConnection,
} from '../src/domains/connections/github';
import { githubEnv, owner, foreign, sampleConnection } from './connections-support';

const repo = {
  id: 99,
  name: 'gent-ascend-collective-app',
  full_name: 'neilaureliuscollective/gent-ascend-collective-app',
  private: true,
  default_branch: 'main',
  owner: { login: 'neilaureliuscollective' },
};

function fetchJson(map: Record<string, unknown>) {
  return async (url: string) => {
    const match = Object.keys(map)
      .filter((part) => url.includes(part))
      .sort((a, b) => b.length - a.length)[0];
    if (!match) throw new ConnectionError(`unexpected ${url}`, 500, 'provider');
    const value = map[match];
    if (value instanceof ConnectionError) throw value;
    return value;
  };
}

describe('GitHub App installation association', () => {
  it('rejects anonymous, expired, replayed and foreign-owner callbacks', async () => {
    const store = memoryStore();
    const expired = githubFlow(owner, new Date(Date.now() - 20 * 60 * 1000));
    expired.expiresAt = new Date(Date.now() - 1000).toISOString();
    await store.beginFlow(expired);
    await expect(
      completeGithubCallback({
        store,
        env: githubEnv,
        personId: owner,
        state: expired.state,
        code: 'code',
        fetchJson: fetchJson({}),
      }),
    ).rejects.toMatchObject({ code: 'expired' });
    const flow = githubFlow(owner);
    await store.beginFlow(flow);
    await expect(
      completeGithubCallback({
        store,
        env: githubEnv,
        personId: foreign,
        state: flow.state,
        code: 'code',
        fetchJson: fetchJson({}),
      }),
    ).rejects.toMatchObject({ code: 'denied' });
    await store.consumeFlow(flow.state, new Date().toISOString());
    await expect(
      completeGithubCallback({
        store,
        env: githubEnv,
        personId: owner,
        state: flow.state,
        code: 'code',
        fetchJson: fetchJson({}),
      }),
    ).rejects.toMatchObject({ code: 'replayed' });
  });

  it('does not trust a forged installation_id without user association', async () => {
    const store = memoryStore();
    const flow = githubFlow(owner);
    flow.claimedInstallationId = '999';
    await store.beginFlow(flow);
    await expect(
      completeGithubCallback({
        store,
        env: githubEnv,
        personId: owner,
        state: flow.state,
        code: 'code',
        fetchJson: fetchJson({
          'login/oauth/access_token': { access_token: 'ghu_user_access_token_1' },
          '/user/installations': { installations: [{ id: 1 }] },
          '/user': { login: 'neil', id: 7 },
        }),
      }),
    ).rejects.toMatchObject({ code: 'denied' });
  });

  it('records a verified selected repository and refuses unauthorized selection', async () => {
    const store = memoryStore();
    const flow = githubFlow(owner);
    flow.claimedInstallationId = '42';
    await store.beginFlow(flow);
    const result = await completeGithubCallback({
      store,
      env: githubEnv,
      personId: owner,
      state: flow.state,
      code: 'code',
      fetchJson: fetchJson({
        'login/oauth/access_token': { access_token: 'ghu_user_access_token_1' },
        '/user': { login: 'neil', id: 7 },
        '/user/installations': { installations: [{ id: 42 }] },
        '/app/installations/42/access_tokens': {
          token: 'ghs_install_access_token',
          expires_at: '2099-01-01T00:00:00Z',
        },
        '/app/installations/42': { app_id: 123456, id: 42 },
        '/installation/repositories': { repositories: [repo] },
        '/repos/neilaureliuscollective/gent-ascend-collective-app': repo,
      }),
    });
    expect(result.connection.status).toBe('connected');
    expect(result.connection.selectedName).toBe(
      'neilaureliuscollective/gent-ascend-collective-app',
    );
    expect(result.connection.capabilities).toMatchObject({ writes: false, contents: 'read' });
    await expect(
      selectGithubRepository({
        store,
        env: githubEnv,
        personId: owner,
        resourceId: '404',
        fetchJson: fetchJson({
          '/app/installations/42/access_tokens': {
            token: 'ghs_install_access_token',
            expires_at: '2099-01-01T00:00:00Z',
          },
          '/installation/repositories': { repositories: [repo] },
        }),
      }),
    ).rejects.toMatchObject({ code: 'denied' });
  });

  it('marks revoked installations from token errors instead of remaining connected', async () => {
    const store = memoryStore();
    await store.upsertConnection(sampleConnection({ selectedName: repo.full_name }));
    await expect(
      verifyGithubConnection({
        store,
        env: githubEnv,
        personId: owner,
        fetchJson: fetchJson({
          '/app/installations/42': new ConnectionError('revoked', 401, 'revoked'),
        }),
      }),
    ).rejects.toMatchObject({ code: 'revoked' });
    expect((await store.readConnection(owner, 'github'))?.status).toBe('revoked');
  });

  it('does not mint tokens for unverified, forged or user-revoked associations', async () => {
    const store = memoryStore();
    await store.upsertConnection(
      sampleConnection({ status: 'connecting', lastVerifiedAt: null, selectedId: '99' }),
    );
    await expect(githubInstallationTokenFor(store, owner, githubEnv)).rejects.toMatchObject({
      code: 'invalid',
    });
    await store.upsertConnection(sampleConnection({ lastVerifiedAt: null }));
    await expect(githubInstallationTokenFor(store, owner, githubEnv)).rejects.toMatchObject({
      code: 'invalid',
    });
    await store.upsertConnection(sampleConnection({ userAuthorization: 'revoked' }));
    await expect(githubInstallationTokenFor(store, owner, githubEnv)).rejects.toMatchObject({
      code: 'invalid',
    });
  });

  it('does not restore verified status after user authorization revocation', async () => {
    const store = memoryStore();
    await store.upsertConnection(
      sampleConnection({
        status: 'expired',
        userAuthorization: 'revoked',
        lastError: 'GitHub user authorization was revoked.',
      }),
    );
    await expect(
      verifyGithubConnection({
        store,
        env: githubEnv,
        personId: owner,
        fetchJson: fetchJson({
          '/app/installations/42': { app_id: 123456, id: 42 },
          '/app/installations/42/access_tokens': {
            token: 'ghs_install_access_token',
            expires_at: '2099-01-01T00:00:00Z',
          },
          '/installation/repositories': { repositories: [repo] },
          '/repos/neilaureliuscollective/gent-ascend-collective-app': repo,
        }),
      }),
    ).rejects.toMatchObject({ code: 'expired' });
    const current = await store.readConnection(owner, 'github');
    expect(current?.status).toBe('expired');
    expect(current?.userAuthorization).toBe('revoked');
    expect(current?.lastVerifiedAt).toBeTruthy();
  });
});
