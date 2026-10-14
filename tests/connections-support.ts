import { generateKeyPairSync } from 'node:crypto';

export const owner = '00000000-0000-4000-8000-000000000001';
export const foreign = '00000000-0000-4000-8000-000000000002';
export const key = 'a'.repeat(64);
export const githubPem = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({
  type: 'pkcs8',
  format: 'pem',
}) as string;

export const githubEnv = {
  CONNECTIONS_CREDENTIAL_KEY: key,
  NEXT_PUBLIC_APP_URL: 'https://app.test',
  GITHUB_APP_ID: '123456',
  GITHUB_APP_SLUG: 'aethelios-connections',
  GITHUB_APP_CLIENT_ID: 'Iv1.testclient',
  GITHUB_APP_CLIENT_SECRET: 'github-client-secret-value',
  GITHUB_APP_PRIVATE_KEY: githubPem,
  GITHUB_APP_WEBHOOK_SECRET: 'github-webhook-secret-value',
};

export const vercelEnv = {
  CONNECTIONS_CREDENTIAL_KEY: key,
  NEXT_PUBLIC_APP_URL: 'https://app.test',
  VERCEL_INTEGRATION_SLUG: 'aethelios',
  VERCEL_INTEGRATION_CLIENT_ID: 'oac_testclient',
  VERCEL_INTEGRATION_CLIENT_SECRET: 'vercel-client-secret-value',
  VERCEL_INTEGRATION_WEBHOOK_SECRET: 'vercel-webhook-secret-value',
};

export const connectedEnv = { ...githubEnv, ...vercelEnv };

export function sampleConnection(
  overrides: Partial<import('../src/domains/connections/schema').ConnectionRecord> = {},
): import('../src/domains/connections/schema').ConnectionRecord {
  const now = new Date().toISOString();
  return {
    id: '11111111-1111-4111-8111-111111111111',
    personId: owner,
    provider: 'github',
    status: 'connected',
    accountLogin: 'neil',
    accountId: '7',
    installationId: '42',
    selectedId: '99',
    selectedName: 'neilaureliuscollective/gent-ascend-collective-app',
    capabilities: {},
    lastVerifiedAt: now,
    lastError: null,
    userAuthorization: 'active',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function githubFetch(handlers: Record<string, unknown>) {
  return async (url: string) => {
    const keyName = Object.keys(handlers).find((item) => url.includes(item) || url === item);
    if (!keyName) throw new Error(`Unexpected GitHub URL ${url}`);
    const value = handlers[keyName];
    if (value instanceof Error) throw value;
    if (value && typeof value === 'object' && 'status' in (value as object)) {
      const response = value as { status: number; body?: unknown };
      return response.body ?? { message: 'error' };
    }
    return value;
  };
}
