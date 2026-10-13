import { z } from 'zod';
import { requireVercelConfig, type vercelIntegrationConfig } from './config';
import { ConnectionError } from './errors';
import { openSecret, randomToken, sealSecret } from './crypto';
import { providerJson, record } from './http';
import {
  deploymentStatus,
  vercelCapability,
  vercelPermissionSummary,
  vercelProjectIdentity,
  type ConnectionRecord,
  type FlowRecord,
  type SelectableResource,
} from './schema';
import type { ConnectionStore } from './store';

type VercelConfig = NonNullable<ReturnType<typeof vercelIntegrationConfig>>;
type Fetcher = typeof providerJson;

const tokenResponse = z.object({
  token_type: z.string().optional(),
  access_token: z.string().min(16).max(400),
  installation_id: z.string().min(4).max(80).optional(),
  user_id: z.string().min(4).max(80).optional(),
  team_id: z.string().min(4).max(80).nullable().optional(),
});

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'User-Agent': 'Aethelios-Connections',
  };
}

export function vercelInstallUrl(config: VercelConfig, state: string) {
  const url = new URL(`https://vercel.com/integrations/${config.slug}/new`);
  url.searchParams.set('state', state);
  return url.toString();
}

export async function exchangeVercelToken(
  config: VercelConfig,
  code: string,
  fetchJson: Fetcher = providerJson,
) {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.callback,
  });
  const parsed = tokenResponse.safeParse(
    await fetchJson('https://api.vercel.com/v2/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body,
    }),
  );
  if (!parsed.success)
    throw new ConnectionError('Vercel did not return a usable integration token.', 502, 'provider');
  return parsed.data;
}

function teamQuery(teamId: string | null | undefined) {
  return teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
}

function projectFrom(value: Record<string, unknown>) {
  const link = record(value.link);
  const parsed = vercelProjectIdentity.safeParse({
    id: value.id,
    name: value.name,
    framework: typeof value.framework === 'string' ? value.framework : null,
    repository:
      typeof link.org === 'string' && typeof link.repo === 'string'
        ? {
            type: typeof link.type === 'string' ? link.type : 'github',
            owner: link.org,
            name: link.repo,
          }
        : typeof link.repo === 'string'
          ? {
              type: typeof link.type === 'string' ? link.type : 'github',
              owner: typeof link.repoOwner === 'string' ? link.repoOwner : '',
              name: link.repo,
            }
          : null,
  });
  return parsed.success ? parsed.data : null;
}

export async function listVercelProjects(
  token: string,
  teamId: string | null,
  fetchJson: Fetcher = providerJson,
): Promise<SelectableResource[]> {
  const data = record(
    await fetchJson(`https://api.vercel.com/v9/projects${teamQuery(teamId)}`, {
      headers: headers(token),
    }),
  );
  return (Array.isArray(data.projects) ? data.projects : [])
    .map((item) => projectFrom(record(item)))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => ({
      id: item.id,
      name: item.name,
      detail: item.repository
        ? `${item.repository.owner}/${item.repository.name}`
        : 'No linked Git repository',
    }));
}

export async function readVercelProject(
  token: string,
  projectId: string,
  teamId: string | null,
  fetchJson: Fetcher = providerJson,
) {
  const project = projectFrom(
    record(
      await fetchJson(
        `https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}${teamQuery(teamId)}`,
        { headers: headers(token) },
      ),
    ),
  );
  if (!project || project.id !== projectId)
    throw new ConnectionError('Vercel did not confirm the selected project.', 403, 'denied');
  return project;
}

export async function readExactCommitDeployment(
  token: string,
  projectId: string,
  commit: string,
  teamId: string | null,
  fetchJson: Fetcher = providerJson,
) {
  if (!/^[a-f0-9]{40}$/.test(commit))
    throw new ConnectionError(
      'Deployment status requires an exact 40-character commit.',
      400,
      'invalid',
    );
  const query = new URLSearchParams({
    projectId,
    sha: commit,
    limit: '10',
  });
  if (teamId) query.set('teamId', teamId);
  const data = record(
    await fetchJson(`https://api.vercel.com/v6/deployments?${query}`, { headers: headers(token) }),
  );
  const deployments = Array.isArray(data.deployments) ? data.deployments.map(record) : [];
  const match = deployments.find((item) => {
    const meta = record(item.meta);
    const sha =
      (typeof item.meta === 'object' && typeof meta.githubCommitSha === 'string'
        ? meta.githubCommitSha
        : null) ?? (typeof item.url === 'string' ? null : null);
    return (
      typeof item.projectId === 'string' &&
      item.projectId === projectId &&
      typeof item.uid === 'string' &&
      (sha === commit ||
        (typeof item.meta === 'object' &&
          (meta.githubCommitSha === commit || meta.gitCommitSha === commit)))
    );
  });
  if (!match) return null;
  const meta = record(match.meta);
  const sha =
    typeof meta.githubCommitSha === 'string'
      ? meta.githubCommitSha
      : typeof meta.gitCommitSha === 'string'
        ? meta.gitCommitSha
        : null;
  if (sha !== commit) return null;
  const parsed = deploymentStatus.safeParse({
    id: match.uid,
    environment:
      typeof match.target === 'string'
        ? match.target
        : typeof match.environment === 'string'
          ? match.environment
          : 'preview',
    commit: sha,
    state: typeof match.readyState === 'string' ? match.readyState : 'UNKNOWN',
    url: typeof match.url === 'string' && match.url.length ? `https://${match.url}` : null,
    createdAt: typeof match.created === 'number' ? match.created : null,
  });
  return parsed.success ? parsed.data : null;
}

export function vercelCapabilitiesView() {
  return vercelCapability.parse({
    project: 'read',
    deployment: 'read',
    user: 'read',
    configuration: 'read',
    writes: false,
  });
}

async function vercelIdentity(token: string, fetchJson: Fetcher) {
  const data = record(
    await fetchJson('https://api.vercel.com/v2/user', { headers: headers(token) }),
  );
  const user = record(data.user);
  const username =
    typeof user.username === 'string'
      ? user.username
      : typeof user.email === 'string'
        ? user.email
        : null;
  const id = typeof user.uid === 'string' ? user.uid : typeof user.id === 'string' ? user.id : null;
  if (!username || !id)
    throw new ConnectionError('Vercel did not identify the authorizing account.', 502, 'provider');
  return { login: username, id };
}

export async function completeVercelCallback(input: {
  store: ConnectionStore;
  env?: Record<string, string | undefined>;
  personId: string;
  state: string;
  code: string | null;
  configurationId: string | null;
  teamId: string | null;
  now?: Date;
  fetchJson?: Fetcher;
}) {
  const config = requireVercelConfig(input.env);
  const now = input.now ?? new Date();
  const fetchJson = input.fetchJson ?? providerJson;
  const flow = await input.store.readFlow(input.state);
  if (!flow || flow.personId !== input.personId || flow.provider !== 'vercel')
    throw new ConnectionError(
      'This Vercel authorization does not match your session.',
      403,
      'denied',
    );
  if (flow.consumedAt)
    throw new ConnectionError('This Vercel authorization was already used.', 409, 'replayed');
  if (Date.parse(flow.expiresAt) <= now.getTime())
    throw new ConnectionError('This Vercel authorization expired. Start again.', 410, 'expired');
  if (!input.code)
    throw new ConnectionError('Vercel did not return an authorization code.', 400, 'invalid');
  const consumed = await input.store.consumeFlow(input.state, now.toISOString());
  if (!consumed)
    throw new ConnectionError('This Vercel authorization was already used.', 409, 'replayed');
  const token = await exchangeVercelToken(config, input.code, fetchJson);
  if (
    input.configurationId &&
    token.installation_id &&
    input.configurationId !== token.installation_id
  )
    throw new ConnectionError(
      'The Vercel installation does not match this callback.',
      403,
      'denied',
    );
  const account = await vercelIdentity(token.access_token, fetchJson);
  const teamId = token.team_id ?? input.teamId;
  const resources = await listVercelProjects(token.access_token, teamId, fetchJson);
  const existing = await input.store.readConnection(input.personId, 'vercel');
  const selected =
    existing?.selectedId && resources.some((item) => item.id === existing.selectedId)
      ? existing
      : resources.length === 1
        ? { selectedId: resources[0]!.id, selectedName: resources[0]!.name }
        : { selectedId: null, selectedName: null };
  const verified = selected.selectedId
    ? await readVercelProject(token.access_token, selected.selectedId, teamId, fetchJson)
    : null;
  const recordRow: ConnectionRecord = {
    id: existing?.id ?? crypto.randomUUID(),
    personId: input.personId,
    provider: 'vercel',
    status: verified ? 'connected' : resources.length ? 'connecting' : 'degraded',
    accountLogin: account.login,
    accountId: account.id,
    installationId: token.installation_id ?? input.configurationId,
    selectedId: verified?.id ?? selected.selectedId,
    selectedName: verified?.name ?? selected.selectedName,
    capabilities: {
      ...vercelCapabilitiesView(),
      teamId,
    },
    lastVerifiedAt: verified ? now.toISOString() : null,
    lastError: verified
      ? null
      : resources.length
        ? null
        : 'The installation has no selected project.',
    userAuthorization: 'active',
    createdAt: existing?.createdAt ?? now.toISOString(),
    updatedAt: now.toISOString(),
  };
  await input.store.upsertConnection(recordRow);
  await input.store.putSecret(
    recordRow.id,
    sealSecret(
      {
        kind: 'vercel-integration',
        accessToken: token.access_token,
        teamId,
        expiresAt: null,
      },
      'credential',
      config.key,
      `${input.personId}|vercel|${recordRow.id}`,
    ),
  );
  return { connection: recordRow, resources };
}

export async function listManagedVercelProjects(
  store: ConnectionStore,
  personId: string,
  env: Record<string, string | undefined> = process.env,
  fetchJson: Fetcher = providerJson,
) {
  const config = requireVercelConfig(env);
  const opened = await vercelSecret(store, personId, config.key);
  if (!opened) return [];
  return listVercelProjects(
    opened.credential.accessToken,
    opened.credential.teamId ?? null,
    fetchJson,
  );
}

async function vercelSecret(store: ConnectionStore, personId: string, key: string) {
  const current = await store.readConnection(personId, 'vercel');
  if (!current) return null;
  const secret = openSecret(
    await store.takeSecret(current.id),
    'credential',
    key,
    `${personId}|vercel|${current.id}`,
  );
  const parsed = z
    .object({
      kind: z.literal('vercel-integration'),
      accessToken: z.string().min(16),
      teamId: z.string().nullable().optional(),
      expiresAt: z.number().nullable().optional(),
    })
    .safeParse(secret);
  return parsed.success ? { current, credential: parsed.data } : null;
}

export async function selectVercelProject(input: {
  store: ConnectionStore;
  env?: Record<string, string | undefined>;
  personId: string;
  resourceId: string;
  now?: Date;
  fetchJson?: Fetcher;
}) {
  const config = requireVercelConfig(input.env);
  const now = input.now ?? new Date();
  const opened = await vercelSecret(input.store, input.personId, config.key);
  if (!opened)
    throw new ConnectionError('Connect Vercel before selecting a project.', 409, 'invalid');
  const resources = await listVercelProjects(
    opened.credential.accessToken,
    opened.credential.teamId ?? null,
    input.fetchJson,
  );
  const selected = resources.find((item) => item.id === input.resourceId);
  if (!selected)
    throw new ConnectionError(
      'That project is not part of this Vercel installation.',
      403,
      'denied',
    );
  const project = await readVercelProject(
    opened.credential.accessToken,
    selected.id,
    opened.credential.teamId ?? null,
    input.fetchJson,
  );
  const next: ConnectionRecord = {
    ...opened.current,
    status: 'connected',
    selectedId: project.id,
    selectedName: project.name,
    capabilities: {
      ...vercelCapabilitiesView(),
      teamId: opened.credential.teamId ?? null,
      repository: project.repository,
    },
    lastVerifiedAt: now.toISOString(),
    lastError: null,
    userAuthorization: 'active',
    updatedAt: now.toISOString(),
  };
  await input.store.upsertConnection(next);
  return { connection: next, resources, project };
}

export async function verifyVercelConnection(input: {
  store: ConnectionStore;
  env?: Record<string, string | undefined>;
  personId: string;
  now?: Date;
  fetchJson?: Fetcher;
}) {
  const config = requireVercelConfig(input.env);
  const now = input.now ?? new Date();
  const opened = await vercelSecret(input.store, input.personId, config.key);
  if (!opened) throw new ConnectionError('Vercel is not connected.', 409, 'invalid');
  try {
    const resources = await listVercelProjects(
      opened.credential.accessToken,
      opened.credential.teamId ?? null,
      input.fetchJson,
    );
    if (opened.current.selectedId) {
      const project = await readVercelProject(
        opened.credential.accessToken,
        opened.current.selectedId,
        opened.credential.teamId ?? null,
        input.fetchJson,
      );
      const next: ConnectionRecord = {
        ...opened.current,
        status: 'connected',
        selectedId: project.id,
        selectedName: project.name,
        capabilities: {
          ...vercelCapabilitiesView(),
          teamId: opened.credential.teamId ?? null,
          repository: project.repository,
        },
        lastVerifiedAt: now.toISOString(),
        lastError: null,
        userAuthorization: 'active',
        updatedAt: now.toISOString(),
      };
      await input.store.upsertConnection(next);
      return { connection: next, resources, project };
    }
    const next: ConnectionRecord = {
      ...opened.current,
      status: resources.length ? 'connecting' : 'degraded',
      lastError: resources.length ? null : 'The installation has no selected project.',
      updatedAt: now.toISOString(),
    };
    await input.store.upsertConnection(next);
    return { connection: next, resources, project: null };
  } catch (error) {
    const code = error instanceof ConnectionError ? error.code : 'verification_failed';
    const status =
      code === 'revoked' ? 'revoked' : code === 'degraded' ? 'degraded' : 'verification_failed';
    await input.store.upsertConnection({
      ...opened.current,
      status,
      lastError: error instanceof ConnectionError ? error.message : 'Vercel verification failed.',
      updatedAt: now.toISOString(),
    });
    throw error;
  }
}

export async function vercelAccess(
  store: ConnectionStore,
  personId: string,
  env: Record<string, string | undefined> = process.env,
) {
  const config = requireVercelConfig(env);
  const opened = await vercelSecret(store, personId, config.key);
  if (
    !opened ||
    opened.current.status !== 'connected' ||
    !opened.current.selectedId ||
    !opened.current.lastVerifiedAt
  )
    throw new ConnectionError('Vercel is not ready for deployment reads.', 409, 'invalid');
  return {
    token: opened.credential.accessToken,
    teamId: opened.credential.teamId ?? null,
    projectId: opened.current.selectedId,
    projectName: opened.current.selectedName,
  };
}

export function vercelFlow(personId: string, now = new Date()): FlowRecord {
  return {
    id: crypto.randomUUID(),
    personId,
    provider: 'vercel',
    state: randomToken(),
    nonce: randomToken(),
    verifier: randomToken(48),
    claimedInstallationId: null,
    expiresAt: new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
    consumedAt: null,
  };
}

export { vercelPermissionSummary };
