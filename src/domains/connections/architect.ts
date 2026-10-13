import 'server-only';
import { Buffer } from 'node:buffer';
import { record, providerJson } from './http';
import { ConnectionError } from './errors';
import { githubAppConfig, vercelIntegrationConfig } from './config';
import { githubAssociationVerified, githubInstallationTokenFor } from './github';
import { readExactCommitDeployment, vercelAccess } from './vercel';
import type { ConnectionStore } from './store';
import { describeConnections } from './service';

/**
 * Server-only Architect contract.
 *
 * Construct (PR #116) may import this module. It must not queue jobs, publish
 * branches, merge, or deploy. Connecting a repository never starts an AI
 * operation. Credentials stay in the encrypted server store and must remain
 * outside any code-execution sandbox and outside generated preview deployments.
 */
export type ArchitectConnectionReadiness = {
  github: {
    ready: boolean;
    repository: { owner: string; name: string; id: number; fullName: string } | null;
    reason: string;
  };
  vercel: {
    ready: boolean;
    project: { id: string; name: string } | null;
    reason: string;
  };
};

export async function architectConnectionReadiness(
  personId: string,
  store: ConnectionStore,
  env: Record<string, string | undefined> = process.env,
): Promise<ArchitectConnectionReadiness> {
  const board = await describeConnections(personId, store, env);
  const githubRecord = await store.readConnection(personId, 'github');
  const githubReady =
    githubAssociationVerified(githubRecord) && Boolean(board.github.selectedName);
  const vercelReady = board.vercel.status === 'connected' && Boolean(board.vercel.selectedId);
  return {
    github: {
      ready: githubReady,
      repository:
        githubReady && board.github.selectedName
          ? {
              owner: board.github.selectedName.split('/')[0]!,
              name: board.github.selectedName.split('/')[1]!,
              id: Number(board.github.selectedId),
              fullName: board.github.selectedName,
            }
          : null,
      reason: githubReady
        ? 'Verified read-only GitHub installation for the selected repository.'
        : board.github.summary,
    },
    vercel: {
      ready: vercelReady,
      project:
        vercelReady && board.vercel.selectedId
          ? {
              id: board.vercel.selectedId,
              name: board.vercel.selectedName ?? board.vercel.selectedId,
            }
          : null,
      reason: vercelReady
        ? 'Verified read-only Vercel installation for the selected project.'
        : board.vercel.summary,
    },
  };
}

export async function architectPinnedSource(
  personId: string,
  store: ConnectionStore,
  path: string,
  sha: string,
  env: Record<string, string | undefined> = process.env,
) {
  if (!/^[a-f0-9]{40}$/.test(sha))
    throw new ConnectionError('Pinned source reads require an exact commit.', 400, 'invalid');
  if (!/^[A-Za-z0-9._/-]+$/.test(path) || path.includes('..'))
    throw new ConnectionError('That source path is not allowed.', 400, 'invalid');
  if (!githubAppConfig(env))
    throw new ConnectionError('GitHub App setup is required.', 503, 'setup_required');
  const token = await githubInstallationTokenFor(store, personId, env);
  const ready = await architectConnectionReadiness(personId, store, env);
  if (!ready.github.ready || !ready.github.repository)
    throw new ConnectionError(ready.github.reason, 409, 'invalid');
  const data = record(
    await providerJson(
      `https://api.github.com/repos/${ready.github.repository.fullName}/contents/${path}?ref=${sha}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    ),
  );
  if (data.encoding !== 'base64' || typeof data.content !== 'string')
    throw new ConnectionError('Pinned source was unavailable.', 404, 'degraded');
  return {
    path,
    sha,
    content: Buffer.from(data.content, 'base64').toString('utf8'),
  };
}

export async function architectPullRequest(
  personId: string,
  store: ConnectionStore,
  number: number,
  env: Record<string, string | undefined> = process.env,
) {
  const token = await githubInstallationTokenFor(store, personId, env);
  const ready = await architectConnectionReadiness(personId, store, env);
  if (!ready.github.ready || !ready.github.repository)
    throw new ConnectionError(ready.github.reason, 409, 'invalid');
  const data = record(
    await providerJson(
      `https://api.github.com/repos/${ready.github.repository.fullName}/pulls/${number}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    ),
  );
  return {
    number: typeof data.number === 'number' ? data.number : number,
    title: typeof data.title === 'string' ? data.title : null,
    state: typeof data.state === 'string' ? data.state : null,
    headSha: typeof record(data.head).sha === 'string' ? String(record(data.head).sha) : null,
    url: typeof data.html_url === 'string' ? data.html_url : null,
  };
}

export async function architectCheckRuns(
  personId: string,
  store: ConnectionStore,
  sha: string,
  env: Record<string, string | undefined> = process.env,
) {
  if (!/^[a-f0-9]{40}$/.test(sha))
    throw new ConnectionError('Check reads require an exact commit.', 400, 'invalid');
  const token = await githubInstallationTokenFor(store, personId, env);
  const ready = await architectConnectionReadiness(personId, store, env);
  if (!ready.github.ready || !ready.github.repository)
    throw new ConnectionError(ready.github.reason, 409, 'invalid');
  const data = record(
    await providerJson(
      `https://api.github.com/repos/${ready.github.repository.fullName}/commits/${sha}/check-runs`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    ),
  );
  const runs = Array.isArray(data.check_runs) ? data.check_runs.map(record) : [];
  return runs.slice(0, 50).map((item) => ({
    id: typeof item.id === 'number' ? item.id : null,
    name: typeof item.name === 'string' ? item.name : 'check',
    status: typeof item.status === 'string' ? item.status : 'unknown',
    conclusion: typeof item.conclusion === 'string' ? item.conclusion : null,
    sha,
  }));
}

export async function architectCommitDeployment(
  personId: string,
  store: ConnectionStore,
  sha: string,
  env: Record<string, string | undefined> = process.env,
) {
  if (!vercelIntegrationConfig(env))
    throw new ConnectionError('Vercel integration setup is required.', 503, 'setup_required');
  const access = await vercelAccess(store, personId, env);
  const deployment = await readExactCommitDeployment(
    access.token,
    access.projectId,
    sha,
    access.teamId,
  );
  if (!deployment)
    throw new ConnectionError(
      'No verified deployment matched the selected project and exact commit.',
      404,
      'degraded',
    );
  return { ...deployment, projectId: access.projectId, projectName: access.projectName };
}
