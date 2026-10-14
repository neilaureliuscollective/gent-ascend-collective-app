import { describe, expect, it } from 'vitest';
import {
  githubAppConfig,
  vercelIntegrationConfig,
  connectionsCredentialKey,
  describeProviderSetup,
} from '../src/domains/connections/config';
import { connectedEnv, githubPem, vercelEnv } from './connections-support';

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
  it('reports missing and invalid setting names without treating webhook as Connect-ready', () => {
    const empty = describeProviderSetup('github', {});
    expect(empty.configurationReady).toBe(false);
    expect(empty.webhookReady).toBe(false);
    expect(empty.accountAuthorized).toBe(false);
    expect(empty.resourceVerified).toBe(false);
    expect(empty.missing).toContain('GITHUB_APP_ID');
    expect(empty.missing).toContain('GITHUB_APP_WEBHOOK_SECRET');
    expect(JSON.stringify(empty)).not.toMatch(/-----BEGIN|PRIVATE KEY-----|secret-value/i);

    const configured = describeProviderSetup('github', connectedEnv);
    expect(configured.configurationReady).toBe(true);
    expect(configured.webhookReady).toBe(true);
    expect(configured.accountAuthorized).toBe(false);
    expect(configured.resourceVerified).toBe(false);
    expect(configured.missing).toEqual([]);
    expect(configured.invalid).toEqual([]);

    const invalidKey = describeProviderSetup('github', {
      ...connectedEnv,
      CONNECTIONS_CREDENTIAL_KEY: 'short',
    });
    expect(invalidKey.configurationReady).toBe(false);
    expect(invalidKey.invalid).toEqual(['CONNECTIONS_CREDENTIAL_KEY']);
    expect(invalidKey.invalid.join()).not.toContain('short');
  });
  it('uses the Vercel integration client secret for webhook signing', () => {
    const config = vercelIntegrationConfig(vercelEnv);
    expect(config?.webhookSecret).toBe(vercelEnv.VERCEL_INTEGRATION_CLIENT_SECRET);
    expect(config?.webhookSecret).not.toBe(vercelEnv.VERCEL_INTEGRATION_WEBHOOK_SECRET);
    const setup = describeProviderSetup('vercel', vercelEnv);
    expect(setup.configurationReady).toBe(true);
    expect(setup.webhookReady).toBe(true);
    expect(setup.missing).not.toContain('VERCEL_INTEGRATION_WEBHOOK_SECRET');
  });
  it('separates authorization and selected-resource verification', () => {
    const authorized = describeProviderSetup('github', connectedEnv, {
      accountLogin: 'neil',
      selectedId: null,
      lastVerifiedAt: null,
      status: 'connecting',
      userAuthorization: 'active',
    });
    expect(authorized.accountAuthorized).toBe(true);
    expect(authorized.resourceVerified).toBe(false);
    const verified = describeProviderSetup('github', connectedEnv, {
      accountLogin: 'neil',
      selectedId: '99',
      lastVerifiedAt: '2026-10-14T00:00:00Z',
      status: 'connected',
      userAuthorization: 'active',
    });
    expect(verified.resourceVerified).toBe(true);
    const revoked = describeProviderSetup('github', connectedEnv, {
      accountLogin: 'neil',
      selectedId: '99',
      lastVerifiedAt: '2026-10-14T00:00:00Z',
      status: 'connected',
      userAuthorization: 'revoked',
    });
    expect(revoked.accountAuthorized).toBe(false);
    expect(revoked.resourceVerified).toBe(false);
  });
});
