import { emptyConnectionSetup } from '@/domains/connections/schema';
import type { FounderOfficeData } from '@/domains/founder-office/service';

const githubSetupRequired = emptyConnectionSetup({
  missing: [
    'NEXT_PUBLIC_APP_URL',
    'CONNECTIONS_CREDENTIAL_KEY',
    'GITHUB_APP_ID',
    'GITHUB_APP_SLUG',
    'GITHUB_APP_CLIENT_ID',
    'GITHUB_APP_CLIENT_SECRET',
    'GITHUB_APP_PRIVATE_KEY',
    'GITHUB_APP_WEBHOOK_SECRET',
  ],
});

const vercelSetupRequired = emptyConnectionSetup({
  missing: [
    'NEXT_PUBLIC_APP_URL',
    'CONNECTIONS_CREDENTIAL_KEY',
    'VERCEL_INTEGRATION_SLUG',
    'VERCEL_INTEGRATION_CLIENT_ID',
    'VERCEL_INTEGRATION_CLIENT_SECRET',
  ],
});

const configuredSetup = emptyConnectionSetup({
  configurationReady: true,
  webhookReady: true,
});

const verifiedSetup = emptyConnectionSetup({
  configurationReady: true,
  webhookReady: true,
  accountAuthorized: true,
  resourceVerified: true,
});
export const founderOfficeFixture: FounderOfficeData = {
  ownerId: 'synthetic-owner',
  person: {
    displayName: 'Synthetic Founder',
    timezone: 'UTC',
    priority: 'Build useful intelligence',
  },
  asOf: '2026-10-11T00:00:00Z',
  companies: [
    {
      id: 'c8000000-0000-4000-8000-000000000001',
      person_id: 'synthetic-owner',
      name: 'Synthetic Company',
      brief: 'Confirmed synthetic company brief. No live business records.',
      version: 1,
      confirmed_at: '2026-10-11T00:00:00Z',
      created_at: '2026-10-11T00:00:00Z',
    },
  ],
  missions: [],
  memories: [],
  proposals: [],
  personalMissions: [],
  operations: {
    windowStart: '2026-10-04T00:00:00Z',
    turns: [],
    usageRecords: 0,
    inputTokens: 0,
    outputTokens: 0,
    incompleteUsage: 0,
    bounded: false,
    workContractReady: true,
    modelConfigured: true,
    model: 'synthetic-model',
    commerceConfigured: false,
  },
  connections: {
    github: {
      provider: 'github',
      label: 'GitHub',
      purpose: 'Read-only selected repository access.',
      status: 'setup_required',
      setupRequired: true,
      configured: false,
      accountLogin: null,
      accountId: null,
      selectedName: null,
      selectedId: null,
      capabilities: [
        'Read repository contents and metadata for the selected repository only.',
        'No administration, secrets, workflows, branch-protection bypass or repository write access.',
      ],
      lastVerifiedAt: null,
      lastError: null,
      installationRemainsHint: '',
      accessMode: 'none',
      resources: [],
      deployment: null,
      summary:
        'Setup required. Register the provider application and server secrets before connecting.',
      setup: githubSetupRequired,
    },
    vercel: {
      provider: 'vercel',
      label: 'Vercel',
      purpose: 'Read-only selected project access.',
      status: 'setup_required',
      setupRequired: true,
      configured: false,
      accountLogin: null,
      accountId: null,
      selectedName: null,
      selectedId: null,
      capabilities: [
        'Read the selected Vercel project and its deployments.',
        'No domain, billing, environment-variable or deployment-write permissions.',
      ],
      lastVerifiedAt: null,
      lastError: null,
      installationRemainsHint: '',
      accessMode: 'none',
      resources: [],
      deployment: null,
      summary:
        'Setup required. Register the provider application and server secrets before connecting.',
      setup: vercelSetupRequired,
    },
  },
};

export { configuredSetup, verifiedSetup };
