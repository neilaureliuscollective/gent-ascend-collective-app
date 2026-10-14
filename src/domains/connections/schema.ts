import { z } from 'zod';

export const providers = ['github', 'vercel'] as const;
export type ConnectionProvider = (typeof providers)[number];

export const connectionStatuses = [
  'setup_required',
  'disconnected',
  'connecting',
  'connected',
  'degraded',
  'expired',
  'revoked',
  'verification_failed',
] as const;
export type ConnectionStatus = (typeof connectionStatuses)[number];

export const githubPermissions = {
  contents: 'read',
  metadata: 'read',
  pull_requests: 'read',
  checks: 'read',
  statuses: 'read',
} as const;

export const githubPermissionSummary = [
  'Read repository contents and metadata for the selected repository only.',
  'Read pull requests, check runs and commit statuses.',
  'Mint short-lived, repository-scoped installation tokens on the server.',
  'No administration, secrets, workflows, branch-protection bypass or repository write access.',
  'Architect publishing remains a later, separately authorized capability.',
] as const;

export const vercelPermissionSummary = [
  'Read the selected Vercel project and its deployments.',
  'Read the current user or team identity for the installation.',
  'Read the integration configuration so Aethelios can confirm project access.',
  'No domain, billing, environment-variable or deployment-write permissions.',
] as const;

export const githubCapability = z.object({
  contents: z.literal('read'),
  metadata: z.literal('read'),
  pullRequests: z.literal('read'),
  checks: z.literal('read'),
  statuses: z.literal('read'),
  writes: z.literal(false),
});

export const vercelCapability = z.object({
  project: z.literal('read'),
  deployment: z.literal('read'),
  user: z.literal('read'),
  configuration: z.literal('read'),
  writes: z.literal(false),
});

export const repositoryIdentity = z.object({
  id: z.number().int().positive(),
  owner: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  fullName: z.string().min(3).max(201),
  private: z.boolean(),
  defaultBranch: z.string().min(1).max(255).nullable(),
});

export const vercelProjectIdentity = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  framework: z.string().max(80).nullable(),
  repository: z
    .object({
      type: z.string().max(40),
      owner: z.string().max(100),
      name: z.string().max(100),
    })
    .nullable(),
});

export const deploymentStatus = z.object({
  id: z.string().min(1).max(80),
  environment: z.string().min(1).max(40),
  commit: z.string().regex(/^[a-f0-9]{40}$/),
  state: z.string().min(1).max(40),
  url: z.url().nullable(),
  createdAt: z.number().int().nullable(),
});

export const connectionRecord = z.object({
  id: z.uuid(),
  personId: z.uuid(),
  provider: z.enum(providers),
  status: z.enum(connectionStatuses),
  accountLogin: z.string().max(200).nullable(),
  accountId: z.string().max(80).nullable(),
  installationId: z.string().max(80).nullable(),
  selectedId: z.string().max(120).nullable(),
  selectedName: z.string().max(201).nullable(),
  capabilities: z.record(z.string(), z.unknown()),
  lastVerifiedAt: z.string().nullable(),
  lastError: z.string().max(400).nullable(),
  userAuthorization: z.enum(['active', 'revoked']).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ConnectionRecord = z.infer<typeof connectionRecord>;

export const flowRecord = z.object({
  id: z.uuid(),
  personId: z.uuid(),
  provider: z.enum(providers),
  state: z.string().min(20).max(80),
  nonce: z.string().min(20).max(80),
  verifier: z.string().min(20).max(120),
  claimedInstallationId: z.string().max(80).nullable(),
  expiresAt: z.string(),
  consumedAt: z.string().nullable(),
});
export type FlowRecord = z.infer<typeof flowRecord>;

export type SelectableResource = {
  id: string;
  name: string;
  detail: string;
  private?: boolean;
};

export type ConnectionSetup = {
  configurationReady: boolean;
  webhookReady: boolean;
  accountAuthorized: boolean;
  resourceVerified: boolean;
  missing: string[];
  invalid: string[];
};

export function emptyConnectionSetup(extras: Partial<ConnectionSetup> = {}): ConnectionSetup {
  return {
    configurationReady: false,
    webhookReady: false,
    accountAuthorized: false,
    resourceVerified: false,
    missing: [],
    invalid: [],
    ...extras,
  };
}

export type ConnectionView = {
  provider: ConnectionProvider;
  label: string;
  purpose: string;
  status: ConnectionStatus;
  setupRequired: boolean;
  configured: boolean;
  accountLogin: string | null;
  accountId: string | null;
  selectedName: string | null;
  selectedId: string | null;
  capabilities: string[];
  lastVerifiedAt: string | null;
  lastError: string | null;
  installationRemainsHint: string;
  accessMode: 'read-only' | 'none';
  resources: SelectableResource[];
  deployment: z.infer<typeof deploymentStatus> | null;
  summary: string;
  setup: ConnectionSetup;
};

export const selectInput = z.object({
  provider: z.enum(providers),
  resourceId: z.string().min(1).max(120),
});

export function statusSummary(view: Pick<ConnectionView, 'status' | 'selectedName' | 'lastError'>) {
  switch (view.status) {
    case 'setup_required':
      return 'Setup required. Register the provider application and server secrets before connecting.';
    case 'disconnected':
      return 'Not connected. Aethelios has no usable credential for this service.';
    case 'connecting':
      return 'Authorization is in progress. Complete the provider prompt, then return here.';
    case 'connected':
      return view.selectedName
        ? `Connected and verified for ${view.selectedName}.`
        : 'Authorized. Select a repository or project to finish verification.';
    case 'degraded':
      return view.lastError ?? 'Connected, but a required resource is missing or reduced.';
    case 'expired':
      return (
        view.lastError ?? 'The provider grant expired. Connect again to restore verified access.'
      );
    case 'revoked':
      return (
        view.lastError ??
        'The provider grant was revoked. Aethelios no longer has usable credentials.'
      );
    case 'verification_failed':
      return (
        view.lastError ?? 'Verification failed. The last successful check could not be repeated.'
      );
  }
}
