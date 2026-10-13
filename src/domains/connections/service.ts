import 'server-only';
import { currentFounderAccess } from '@/domains/access/founder';
import { IntelligenceError } from '@/domains/intelligence/service';
import { intelligenceSession } from '@/domains/intelligence/service';
import {
  appOrigin,
  connectionsCredentialKey,
  flowCookieName,
  githubAppConfig,
  requireGithubConfig,
  requireVercelConfig,
  vercelIntegrationConfig,
} from './config';
import { ConnectionError } from './errors';
import {
  githubAuthorizeUrl,
  githubFlow,
  githubInstallUrl,
  completeGithubCallback,
  listInstallationRepositories,
  mintInstallationToken,
  selectGithubRepository,
  verifyGithubConnection,
} from './github';
import {
  completeVercelCallback,
  listManagedVercelProjects,
  selectVercelProject,
  vercelFlow,
  vercelInstallUrl,
  vercelPermissionSummary,
  verifyVercelConnection,
} from './vercel';
import {
  githubPermissionSummary,
  selectInput,
  statusSummary,
  type ConnectionProvider,
  type ConnectionRecord,
  type ConnectionStatus,
  type ConnectionView,
  type SelectableResource,
} from './schema';
import { sessionStore, type ConnectionStore } from './store';

export async function connectionsSession() {
  const session = await intelligenceSession();
  if (!(await currentFounderAccess()))
    throw new ConnectionError('Founder access required.', 403, 'denied');
  return { ...session, store: sessionStore(session.client) };
}

function emptyView(
  provider: ConnectionProvider,
  status: ConnectionStatus,
  extras: Partial<ConnectionView> = {},
): ConnectionView {
  const base: ConnectionView = {
    provider,
    label: provider === 'github' ? 'GitHub' : 'Vercel',
    purpose:
      provider === 'github'
        ? 'Read-only access to a selected repository’s contents, pull requests and checks.'
        : 'Read-only access to a selected project’s deployments and repository association.',
    status,
    setupRequired: status === 'setup_required',
    configured: status !== 'setup_required',
    accountLogin: null,
    accountId: null,
    selectedName: null,
    selectedId: null,
    capabilities: [...(provider === 'github' ? githubPermissionSummary : vercelPermissionSummary)],
    lastVerifiedAt: null,
    lastError: extras.lastError ?? null,
    installationRemainsHint:
      provider === 'github'
        ? 'Disconnecting removes Aethelios credentials. The GitHub App installation remains until you uninstall it on GitHub.'
        : 'Disconnecting removes Aethelios credentials. The Vercel integration remains until you uninstall it in Vercel.',
    accessMode: status === 'connected' || status === 'degraded' ? 'read-only' : 'none',
    resources: extras.resources ?? [],
    deployment: extras.deployment ?? null,
    summary: '',
  };
  const view = { ...base, ...extras, provider, status };
  return { ...view, summary: statusSummary(view) };
}

function fromRecord(
  record: ConnectionRecord | null,
  provider: ConnectionProvider,
  configured: boolean,
  resources: SelectableResource[] = [],
): ConnectionView {
  if (!configured) return emptyView(provider, 'setup_required');
  if (!record) return emptyView(provider, 'disconnected', { configured: true });
  return emptyView(provider, record.status, {
    configured: true,
    accountLogin: record.accountLogin,
    accountId: record.accountId,
    selectedName: record.selectedName,
    selectedId: record.selectedId,
    lastVerifiedAt: record.lastVerifiedAt,
    lastError: record.lastError,
    resources,
    accessMode:
      record.status === 'connected' || record.status === 'degraded' ? 'read-only' : 'none',
  });
}

export async function describeConnections(
  personId: string,
  store: ConnectionStore,
  env: Record<string, string | undefined> = process.env,
): Promise<{ github: ConnectionView; vercel: ConnectionView }> {
  const [github, vercel] = await Promise.all([
    store.readConnection(personId, 'github'),
    store.readConnection(personId, 'vercel'),
  ]);
  let githubResources: SelectableResource[] = [];
  let vercelResources: SelectableResource[] = [];
  const githubConfig = githubAppConfig(env);
  if (github?.installationId && github.status === 'connecting' && githubConfig) {
    try {
      const minted = await mintInstallationToken(githubConfig, github.installationId);
      githubResources = await listInstallationRepositories(minted.token);
    } catch {
      githubResources = [];
    }
  }
  const vercelConfig = vercelIntegrationConfig(env);
  if (vercel && vercel.status === 'connecting' && vercelConfig) {
    try {
      vercelResources = await listManagedVercelProjects(store, personId, env);
    } catch {
      vercelResources = [];
    }
  }
  return {
    github: fromRecord(github, 'github', Boolean(githubConfig), githubResources),
    vercel: fromRecord(vercel, 'vercel', Boolean(vercelConfig), vercelResources),
  };
}

export async function readConnectionsBoard() {
  const { person, store } = await connectionsSession();
  return describeConnections(person.id, store);
}

export function cookieOptions(origin: string) {
  const secure = origin.startsWith('https://');
  return {
    name: flowCookieName(secure),
    options: {
      httpOnly: true as const,
      secure,
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 600,
    },
  };
}

export async function startGithubConnection() {
  const { person, store } = await connectionsSession();
  const config = requireGithubConfig();
  const origin = appOrigin();
  if (!origin || origin !== config.origin)
    throw new ConnectionError(
      'The application origin is not registered for GitHub.',
      503,
      'setup_required',
    );
  const flow = githubFlow(person.id);
  await store.beginFlow(flow);
  return {
    location: githubInstallUrl(config, flow.state),
    state: flow.state,
    cookie: cookieOptions(origin),
  };
}

export async function continueGithubSetup(state: string | null, installationId: string | null) {
  const { person, store } = await connectionsSession();
  const config = requireGithubConfig();
  if (!state)
    throw new ConnectionError(
      'This GitHub setup request is missing its session token.',
      400,
      'invalid',
    );
  const flow = await store.readFlow(state);
  if (!flow || flow.personId !== person.id || flow.provider !== 'github' || flow.consumedAt)
    throw new ConnectionError(
      'This GitHub setup request does not match your session.',
      403,
      'denied',
    );
  if (Date.parse(flow.expiresAt) <= Date.now())
    throw new ConnectionError('This GitHub setup request expired. Start again.', 410, 'expired');
  if (installationId) {
    const claimed = await store.claimInstallation(state, installationId);
    if (!claimed)
      throw new ConnectionError('This GitHub setup request was already used.', 409, 'replayed');
  }
  return {
    location: githubAuthorizeUrl(config, state, flow.verifier),
    cookie: cookieOptions(config.origin),
  };
}

export async function finishGithubCallback(input: {
  state: string | null;
  code: string | null;
  cookieState: string | null;
}) {
  const { person, store } = await connectionsSession();
  if (!input.state || !input.cookieState || input.state !== input.cookieState)
    throw new ConnectionError(
      'The GitHub callback state did not match this session.',
      403,
      'denied',
    );
  return completeGithubCallback({
    store,
    personId: person.id,
    state: input.state,
    code: input.code,
  });
}

export async function startVercelConnection() {
  const { person, store } = await connectionsSession();
  const config = requireVercelConfig();
  const flow = vercelFlow(person.id);
  await store.beginFlow(flow);
  return {
    location: vercelInstallUrl(config, flow.state),
    state: flow.state,
    cookie: cookieOptions(config.origin),
  };
}

export async function finishVercelCallback(input: {
  state: string | null;
  code: string | null;
  configurationId: string | null;
  teamId: string | null;
  cookieState: string | null;
}) {
  const { person, store } = await connectionsSession();
  if (!input.state || !input.cookieState || input.state !== input.cookieState)
    throw new ConnectionError(
      'The Vercel callback state did not match this session.',
      403,
      'denied',
    );
  return completeVercelCallback({
    store,
    personId: person.id,
    state: input.state,
    code: input.code,
    configurationId: input.configurationId,
    teamId: input.teamId,
  });
}

export async function selectConnection(body: unknown) {
  const { person, store } = await connectionsSession();
  const input = selectInput.safeParse(body);
  if (!input.success)
    throw new ConnectionError(
      'Choose a repository or project from the verified list.',
      400,
      'invalid',
    );
  if (input.data.provider === 'github')
    return selectGithubRepository({
      store,
      personId: person.id,
      resourceId: input.data.resourceId,
    });
  return selectVercelProject({
    store,
    personId: person.id,
    resourceId: input.data.resourceId,
  });
}

export async function verifyConnection(provider: ConnectionProvider) {
  const { person, store } = await connectionsSession();
  if (provider === 'github') return verifyGithubConnection({ store, personId: person.id });
  return verifyVercelConnection({ store, personId: person.id });
}

export async function disconnectConnection(provider: ConnectionProvider) {
  const { person, store } = await connectionsSession();
  const current = await store.readConnection(person.id, provider);
  await store.clearConnection(person.id, provider);
  return {
    disconnected: true,
    provider,
    installationRemoved: false,
    installationHint:
      provider === 'github'
        ? 'Aethelios credentials were removed. Uninstall the GitHub App in GitHub settings if you also want to revoke the installation.'
        : 'Aethelios credentials were removed. Uninstall the integration in Vercel if you also want to revoke the installation.',
    hadConnection: Boolean(current),
  };
}

export async function listGithubResources() {
  const { person, store } = await connectionsSession();
  const config = requireGithubConfig();
  const current = await store.readConnection(person.id, 'github');
  if (!current?.installationId)
    throw new ConnectionError('Connect GitHub before listing repositories.', 409, 'invalid');
  const minted = await mintInstallationToken(config, current.installationId);
  return listInstallationRepositories(minted.token);
}

export function asIntelligence(error: unknown) {
  if (error instanceof ConnectionError) return new IntelligenceError(error.message, error.status);
  return error;
}

export { connectionsCredentialKey, githubPermissionSummary, vercelPermissionSummary };
