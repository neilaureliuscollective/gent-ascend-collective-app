import { z } from 'zod';
import { requireGithubConfig, type githubAppConfig } from './config';
import { ConnectionError } from './errors';
import { githubAppJwt, openSecret, pkceChallenge, randomToken, sealSecret } from './crypto';
import { providerJson, record } from './http';
import {
  githubCapability,
  githubPermissionSummary,
  githubPermissions,
  repositoryIdentity,
  type ConnectionRecord,
  type FlowRecord,
  type SelectableResource,
} from './schema';
import type { ConnectionStore } from './store';

type GithubConfig = NonNullable<ReturnType<typeof githubAppConfig>>;
type Fetcher = typeof providerJson;

const userToken = z.object({
  access_token: z.string().min(20).max(400),
  token_type: z.string().optional(),
  expires_in: z.number().int().positive().optional(),
  refresh_token: z.string().min(20).max(400).optional(),
  refresh_token_expires_in: z.number().int().positive().optional(),
});

const installationToken = z.object({
  token: z.string().min(20).max(400),
  expires_at: z.string(),
});

function headers(token: string, jwt = false) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `${jwt ? 'Bearer' : 'Bearer'} ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'Aethelios-Connections',
  };
}

export function githubInstallUrl(config: GithubConfig, state: string) {
  const url = new URL(`https://github.com/apps/${config.slug}/installations/new`);
  url.searchParams.set('state', state);
  return url.toString();
}

export function githubAuthorizeUrl(config: GithubConfig, state: string, verifier: string) {
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.callback);
  url.searchParams.set('state', state);
  url.searchParams.set('allow_signup', 'false');
  url.searchParams.set('code_challenge', pkceChallenge(verifier));
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

export async function exchangeGithubUserToken(
  config: GithubConfig,
  code: string,
  verifier: string,
  fetchJson: Fetcher = providerJson,
) {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.callback,
    code_verifier: verifier,
  });
  const data = record(
    await fetchJson('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    }),
  );
  const parsed = userToken.safeParse(data);
  if (!parsed.success)
    throw new ConnectionError(
      'GitHub did not return a usable user authorization.',
      502,
      'provider',
    );
  return parsed.data;
}

export async function mintInstallationToken(
  config: GithubConfig,
  installationId: string,
  repositoryIds: number[] = [],
  fetchJson: Fetcher = providerJson,
  now = Math.floor(Date.now() / 1000),
) {
  const jwt = githubAppJwt(config.appId, config.privateKey, now);
  const payload: Record<string, unknown> = { permissions: githubPermissions };
  if (repositoryIds.length) payload.repository_ids = repositoryIds;
  const data = record(
    await fetchJson(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
      method: 'POST',
      headers: { ...headers(jwt, true), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  );
  const parsed = installationToken.safeParse(data);
  if (!parsed.success)
    throw new ConnectionError(
      'GitHub did not issue a repository installation token.',
      502,
      'provider',
    );
  return parsed.data;
}

async function githubUser(token: string, fetchJson: Fetcher) {
  const data = record(await fetchJson('https://api.github.com/user', { headers: headers(token) }));
  const login = typeof data.login === 'string' ? data.login : null;
  const id = typeof data.id === 'number' ? String(data.id) : null;
  if (!login || !id)
    throw new ConnectionError('GitHub did not identify the authorizing account.', 502, 'provider');
  return { login, id };
}

async function userInstallations(token: string, fetchJson: Fetcher) {
  const data = record(
    await fetchJson('https://api.github.com/user/installations?per_page=100', {
      headers: headers(token),
    }),
  );
  return Array.isArray(data.installations) ? data.installations.map(record) : [];
}

async function appInstallation(
  config: GithubConfig,
  installationId: string,
  fetchJson: Fetcher,
  now: number,
) {
  const jwt = githubAppJwt(config.appId, config.privateKey, now);
  return record(
    await fetchJson(`https://api.github.com/app/installations/${installationId}`, {
      headers: headers(jwt, true),
    }),
  );
}

function repositoryFrom(value: Record<string, unknown>) {
  const owner = record(value.owner);
  const parsed = repositoryIdentity.safeParse({
    id: value.id,
    owner: owner.login,
    name: value.name,
    fullName: value.full_name,
    private: value.private,
    defaultBranch: typeof value.default_branch === 'string' ? value.default_branch : null,
  });
  return parsed.success ? parsed.data : null;
}

export async function listInstallationRepositories(
  token: string,
  fetchJson: Fetcher = providerJson,
): Promise<SelectableResource[]> {
  const data = record(
    await fetchJson('https://api.github.com/installation/repositories?per_page=100', {
      headers: headers(token),
    }),
  );
  return (Array.isArray(data.repositories) ? data.repositories : [])
    .map((item) => repositoryFrom(record(item)))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => ({
      id: String(item.id),
      name: item.fullName,
      detail: item.private ? 'Private repository · read-only' : 'Public repository · read-only',
      private: item.private,
    }));
}

export async function verifyRepositoryAccess(
  token: string,
  fullName: string,
  fetchJson: Fetcher = providerJson,
) {
  const data = record(
    await fetchJson(`https://api.github.com/repos/${fullName}`, { headers: headers(token) }),
  );
  const repo = repositoryFrom(data);
  if (!repo || repo.fullName !== fullName)
    throw new ConnectionError('GitHub did not confirm the selected repository.', 403, 'denied');
  return repo;
}

export function githubCapabilitiesView() {
  return githubCapability.parse({
    contents: 'read',
    metadata: 'read',
    pullRequests: 'read',
    checks: 'read',
    statuses: 'read',
    writes: false,
  });
}

export async function completeGithubCallback(input: {
  store: ConnectionStore;
  env?: Record<string, string | undefined>;
  personId: string;
  state: string;
  code: string | null;
  now?: Date;
  fetchJson?: Fetcher;
}) {
  const config = requireGithubConfig(input.env);
  const now = input.now ?? new Date();
  const fetchJson = input.fetchJson ?? providerJson;
  const flow = await input.store.readFlow(input.state);
  if (!flow || flow.personId !== input.personId || flow.provider !== 'github')
    throw new ConnectionError(
      'This GitHub authorization does not match your session.',
      403,
      'denied',
    );
  if (flow.consumedAt)
    throw new ConnectionError('This GitHub authorization was already used.', 409, 'replayed');
  if (Date.parse(flow.expiresAt) <= now.getTime())
    throw new ConnectionError('This GitHub authorization expired. Start again.', 410, 'expired');
  if (!input.code)
    throw new ConnectionError('GitHub did not return an authorization code.', 400, 'invalid');
  const consumed = await input.store.consumeFlow(input.state, now.toISOString());
  if (!consumed)
    throw new ConnectionError('This GitHub authorization was already used.', 409, 'replayed');
  const token = await exchangeGithubUserToken(config, input.code, flow.verifier, fetchJson);
  const account = await githubUser(token.access_token, fetchJson);
  const installations = await userInstallations(token.access_token, fetchJson);
  const claimed = flow.claimedInstallationId;
  const match = installations.find((item) => {
    const id = typeof item.id === 'number' ? String(item.id) : null;
    return claimed ? id === claimed : installations.length === 1;
  });
  const installationId = typeof match?.id === 'number' ? String(match.id) : null;
  if (!installationId)
    throw new ConnectionError(
      claimed
        ? 'The GitHub installation is not associated with the authorizing account.'
        : 'Select exactly one GitHub installation, then try again.',
      403,
      'denied',
    );
  const appInstall = await appInstallation(
    config,
    installationId,
    fetchJson,
    Math.floor(now.getTime() / 1000),
  );
  if (String(appInstall.app_id) !== config.appId)
    throw new ConnectionError(
      'That installation does not belong to the Aethelios GitHub App.',
      403,
      'denied',
    );
  const minted = await mintInstallationToken(
    config,
    installationId,
    [],
    fetchJson,
    Math.floor(now.getTime() / 1000),
  );
  const resources = await listInstallationRepositories(minted.token, fetchJson);
  const existing = await input.store.readConnection(input.personId, 'github');
  const selected =
    existing?.selectedId && resources.some((item) => item.id === existing.selectedId)
      ? existing
      : resources.length === 1
        ? { selectedId: resources[0]!.id, selectedName: resources[0]!.name }
        : { selectedId: null, selectedName: null };
  const verified = selected.selectedName
    ? await verifyRepositoryAccess(minted.token, selected.selectedName, fetchJson)
    : null;
  const recordRow: ConnectionRecord = {
    id: existing?.id ?? crypto.randomUUID(),
    personId: input.personId,
    provider: 'github',
    status: verified ? 'connected' : resources.length ? 'connecting' : 'degraded',
    accountLogin: account.login,
    accountId: account.id,
    installationId,
    selectedId: verified ? String(verified.id) : selected.selectedId,
    selectedName: verified ? verified.fullName : selected.selectedName,
    capabilities: githubCapabilitiesView(),
    lastVerifiedAt: verified ? now.toISOString() : null,
    lastError: verified
      ? null
      : resources.length
        ? null
        : 'The installation has no selected repository.',
    createdAt: existing?.createdAt ?? now.toISOString(),
    updatedAt: now.toISOString(),
  };
  await input.store.upsertConnection(recordRow);
  await input.store.putSecret(
    recordRow.id,
    sealSecret(
      {
        kind: 'github-user',
        accessToken: token.access_token,
        refreshToken: token.refresh_token ?? null,
        expiresAt: token.expires_in ? now.getTime() + token.expires_in * 1000 : null,
      },
      'credential',
      config.key,
      `${input.personId}|github|${recordRow.id}`,
    ),
  );
  return { connection: recordRow, resources };
}

export async function selectGithubRepository(input: {
  store: ConnectionStore;
  env?: Record<string, string | undefined>;
  personId: string;
  resourceId: string;
  now?: Date;
  fetchJson?: Fetcher;
}) {
  const config = requireGithubConfig(input.env);
  const now = input.now ?? new Date();
  const current = await input.store.readConnection(input.personId, 'github');
  if (!current?.installationId)
    throw new ConnectionError('Connect GitHub before selecting a repository.', 409, 'invalid');
  const minted = await mintInstallationToken(
    config,
    current.installationId,
    [],
    input.fetchJson,
    Math.floor(now.getTime() / 1000),
  );
  const resources = await listInstallationRepositories(minted.token, input.fetchJson);
  const selected = resources.find((item) => item.id === input.resourceId);
  if (!selected)
    throw new ConnectionError(
      'That repository is not part of this GitHub installation.',
      403,
      'denied',
    );
  const scoped = await mintInstallationToken(
    config,
    current.installationId,
    [Number(selected.id)],
    input.fetchJson,
    Math.floor(now.getTime() / 1000),
  );
  const repo = await verifyRepositoryAccess(scoped.token, selected.name, input.fetchJson);
  const next: ConnectionRecord = {
    ...current,
    status: 'connected',
    selectedId: String(repo.id),
    selectedName: repo.fullName,
    capabilities: githubCapabilitiesView(),
    lastVerifiedAt: now.toISOString(),
    lastError: null,
    updatedAt: now.toISOString(),
  };
  await input.store.upsertConnection(next);
  return { connection: next, resources };
}

export async function verifyGithubConnection(input: {
  store: ConnectionStore;
  env?: Record<string, string | undefined>;
  personId: string;
  now?: Date;
  fetchJson?: Fetcher;
}) {
  const config = requireGithubConfig(input.env);
  const now = input.now ?? new Date();
  const current = await input.store.readConnection(input.personId, 'github');
  if (!current?.installationId)
    throw new ConnectionError('GitHub is not connected.', 409, 'invalid');
  try {
    const appInstall = await appInstallation(
      config,
      current.installationId,
      input.fetchJson ?? providerJson,
      Math.floor(now.getTime() / 1000),
    );
    if (String(appInstall.app_id) !== config.appId)
      throw new ConnectionError('Installation mismatch.', 403, 'denied');
    const minted = await mintInstallationToken(
      config,
      current.installationId,
      current.selectedId ? [Number(current.selectedId)] : [],
      input.fetchJson,
      Math.floor(now.getTime() / 1000),
    );
    const resources = await listInstallationRepositories(
      (
        await mintInstallationToken(
          config,
          current.installationId,
          [],
          input.fetchJson,
          Math.floor(now.getTime() / 1000),
        )
      ).token,
      input.fetchJson,
    );
    if (current.selectedName) {
      const repo = await verifyRepositoryAccess(
        minted.token,
        current.selectedName,
        input.fetchJson,
      );
      const next: ConnectionRecord = {
        ...current,
        status: 'connected',
        selectedId: String(repo.id),
        selectedName: repo.fullName,
        lastVerifiedAt: now.toISOString(),
        lastError: null,
        updatedAt: now.toISOString(),
      };
      await input.store.upsertConnection(next);
      return { connection: next, resources };
    }
    const next: ConnectionRecord = {
      ...current,
      status: resources.length ? 'connecting' : 'degraded',
      lastError: resources.length ? null : 'The installation has no selected repository.',
      updatedAt: now.toISOString(),
    };
    await input.store.upsertConnection(next);
    return { connection: next, resources };
  } catch (error) {
    const code = error instanceof ConnectionError ? error.code : 'verification_failed';
    const status =
      code === 'revoked' ? 'revoked' : code === 'degraded' ? 'degraded' : 'verification_failed';
    if (current) {
      await input.store.upsertConnection({
        ...current,
        status,
        lastError: error instanceof ConnectionError ? error.message : 'GitHub verification failed.',
        updatedAt: now.toISOString(),
      });
    }
    throw error;
  }
}

export async function githubInstallationTokenFor(
  store: ConnectionStore,
  personId: string,
  env: Record<string, string | undefined> = process.env,
  fetchJson: Fetcher = providerJson,
  now = Math.floor(Date.now() / 1000),
) {
  const config = requireGithubConfig(env);
  const current = await store.readConnection(personId, 'github');
  if (!current?.installationId || current.status !== 'connected' || !current.selectedId)
    throw new ConnectionError('GitHub is not ready for source reads.', 409, 'invalid');
  return mintInstallationToken(
    config,
    current.installationId,
    [Number(current.selectedId)],
    fetchJson,
    now,
  );
}

export async function readGithubUserSecret(store: ConnectionStore, personId: string, key: string) {
  const current = await store.readConnection(personId, 'github');
  if (!current) return null;
  return openSecret(
    await store.takeSecret(current.id),
    'credential',
    key,
    `${personId}|github|${current.id}`,
  );
}

export function githubFlow(personId: string, now = new Date()): FlowRecord {
  return {
    id: crypto.randomUUID(),
    personId,
    provider: 'github',
    state: randomToken(),
    nonce: randomToken(),
    verifier: randomToken(48),
    claimedInstallationId: null,
    expiresAt: new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
    consumedAt: null,
  };
}

export { githubPermissionSummary };
