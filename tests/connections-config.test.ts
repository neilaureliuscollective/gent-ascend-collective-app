import { describe, expect, it } from 'vitest';
import {
  githubAppConfig,
  vercelIntegrationConfig,
  connectionsCredentialKey,
} from '../src/domains/connections/config';
import { connectedEnv, githubPem } from './connections-support';

describe('Connections configuration', () => {
  it('does not treat environment variables as a successful connection', () => {
    expect(githubAppConfig({})).toBeNull();
    expect(vercelIntegrationConfig({})).toBeNull();
    expect(connectionsCredentialKey({})).toBeNull();
    expect(githubAppConfig(connectedEnv)?.appId).toBe('123456');
    expect(vercelIntegrationConfig(connectedEnv)?.slug).toBe('aethelios');
  });
  it('rejects reused or malformed credential keys and non-loopback http origins', () => {
    expect(githubAppConfig({ ...connectedEnv, CONNECTIONS_CREDENTIAL_KEY: 'short' })).toBeNull();
    expect(
      githubAppConfig({ ...connectedEnv, NEXT_PUBLIC_APP_URL: 'http://example.com' }),
    ).toBeNull();
    expect(
      githubAppConfig({ ...connectedEnv, NEXT_PUBLIC_APP_URL: 'https://app.test/callback' }),
    ).toBeNull();
    expect(githubAppConfig({ ...connectedEnv, GITHUB_APP_PRIVATE_KEY: 'not-a-pem' })).toBeNull();
    expect(githubPem).toContain('PRIVATE KEY');
  });
});
