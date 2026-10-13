import { describe, expect, it } from 'vitest';
import { ConnectionError } from '../src/domains/connections/errors';
import { memoryStore } from '../src/domains/connections/store';
import {
  completeVercelCallback,
  readExactCommitDeployment,
  selectVercelProject,
  vercelFlow,
  verifyVercelConnection,
} from '../src/domains/connections/vercel';
import { owner, foreign, vercelEnv } from './connections-support';

const sha = 'b'.repeat(40);
const project = {
  id: 'prj_selected',
  name: 'gent-ascend-collective-app',
  framework: 'nextjs',
  link: { type: 'github', org: 'neilaureliuscollective', repo: 'gent-ascend-collective-app' },
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

describe('Vercel integration connection', () => {
  it('rejects foreign, expired and replayed callbacks and requires a code', async () => {
    const store = memoryStore();
    const flow = vercelFlow(owner);
    await store.beginFlow(flow);
    await expect(
      completeVercelCallback({
        store,
        env: vercelEnv,
        personId: foreign,
        state: flow.state,
        code: 'code',
        configurationId: 'icfg_1',
        teamId: null,
        fetchJson: fetchJson({}),
      }),
    ).rejects.toMatchObject({ code: 'denied' });
    await expect(
      completeVercelCallback({
        store,
        env: vercelEnv,
        personId: owner,
        state: flow.state,
        code: null,
        configurationId: 'icfg_1',
        teamId: null,
        fetchJson: fetchJson({}),
      }),
    ).rejects.toMatchObject({ code: 'invalid' });
    await store.consumeFlow(flow.state, new Date().toISOString());
    await expect(
      completeVercelCallback({
        store,
        env: vercelEnv,
        personId: owner,
        state: flow.state,
        code: 'code',
        configurationId: 'icfg_1',
        teamId: null,
        fetchJson: fetchJson({}),
      }),
    ).rejects.toMatchObject({ code: 'replayed' });
  });

  it('rejects a mismatched configuration id and unauthorized project selection', async () => {
    const store = memoryStore();
    const flow = vercelFlow(owner);
    await store.beginFlow(flow);
    await expect(
      completeVercelCallback({
        store,
        env: vercelEnv,
        personId: owner,
        state: flow.state,
        code: 'code',
        configurationId: 'icfg_forged',
        teamId: 'team_1',
        fetchJson: fetchJson({
          '/v2/oauth/access_token': {
            access_token: 'vercel-access-token-1',
            installation_id: 'icfg_real',
            user_id: 'user_1',
            team_id: 'team_1',
          },
        }),
      }),
    ).rejects.toMatchObject({ code: 'denied' });
    const next = vercelFlow(owner);
    await store.beginFlow(next);
    const connected = await completeVercelCallback({
      store,
      env: vercelEnv,
      personId: owner,
      state: next.state,
      code: 'code',
      configurationId: 'icfg_real',
      teamId: 'team_1',
      fetchJson: fetchJson({
        '/v2/oauth/access_token': {
          access_token: 'vercel-access-token-1',
          installation_id: 'icfg_real',
          user_id: 'user_1',
          team_id: 'team_1',
        },
        '/v2/user': { user: { username: 'neil', uid: 'user_1' } },
        '/v9/projects': { projects: [project] },
        '/v9/projects/prj_selected': project,
      }),
    });
    expect(connected.connection.status).toBe('connected');
    await expect(
      selectVercelProject({
        store,
        env: vercelEnv,
        personId: owner,
        resourceId: 'prj_other',
        fetchJson: fetchJson({ '/v9/projects': { projects: [project] } }),
      }),
    ).rejects.toMatchObject({ code: 'denied' });
  });

  it('binds deployment status to the selected project and exact commit', async () => {
    const fetch = fetchJson({
      '/v6/deployments': {
        deployments: [
          {
            uid: 'dpl_1',
            projectId: 'prj_selected',
            readyState: 'READY',
            url: 'preview.example',
            target: 'preview',
            created: 1,
            meta: { githubCommitSha: sha },
          },
        ],
      },
    });
    const matched = await readExactCommitDeployment('token', 'prj_selected', sha, null, fetch);
    expect(matched).toMatchObject({ id: 'dpl_1', commit: sha, environment: 'preview' });
    await expect(
      readExactCommitDeployment('token', 'prj_selected', 'c'.repeat(40), null, fetch),
    ).resolves.toBeNull();
    const forged = fetchJson({
      '/v6/deployments': {
        deployments: [
          {
            uid: 'dpl_forged',
            projectId: 'prj_other',
            readyState: 'READY',
            url: 'evil.example',
            target: 'production',
            meta: { githubCommitSha: sha },
          },
        ],
      },
    });
    await expect(
      readExactCommitDeployment('token', 'prj_selected', sha, null, forged),
    ).resolves.toBeNull();
  });

  it('does not assume GitHub-style expiry when verifying a long-lived Vercel token', async () => {
    const store = memoryStore();
    const flow = vercelFlow(owner);
    await store.beginFlow(flow);
    await completeVercelCallback({
      store,
      env: vercelEnv,
      personId: owner,
      state: flow.state,
      code: 'code',
      configurationId: 'icfg_real',
      teamId: null,
      fetchJson: fetchJson({
        '/v2/oauth/access_token': {
          access_token: 'long-lived-token',
          installation_id: 'icfg_real',
          user_id: 'user_1',
          team_id: null,
        },
        '/v2/user': { user: { username: 'neil', uid: 'user_1' } },
        '/v9/projects': { projects: [project] },
        '/v9/projects/prj_selected': project,
      }),
    });
    const verified = await verifyVercelConnection({
      store,
      env: vercelEnv,
      personId: owner,
      fetchJson: fetchJson({
        '/v9/projects': { projects: [project] },
        '/v9/projects/prj_selected': project,
      }),
    });
    expect(verified.connection.status).toBe('connected');
    expect(verified.connection.lastVerifiedAt).toBeTruthy();
  });
});
