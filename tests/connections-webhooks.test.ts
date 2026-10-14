import { describe, expect, it } from 'vitest';
import { hmacHex } from '../src/domains/connections/crypto';
import { memoryStore } from '../src/domains/connections/store';
import {
  applyGithubWebhook,
  applyVercelWebhook,
  verifyGithubSignature,
  verifyVercelSignature,
} from '../src/domains/connections/webhooks';
import { owner, sampleConnection } from './connections-support';
import { createHmac } from 'node:crypto';

describe('Connection webhook verification', () => {
  it('rejects forged GitHub signatures and deduplicates deliveries', async () => {
    const body = '{"action":"deleted","installation":{"id":42}}';
    const secret = 'github-webhook-secret-value';
    expect(verifyGithubSignature(secret, body, 'sha256=deadbeef')).toBe(false);
    expect(verifyGithubSignature(secret, body, `sha256=${hmacHex('sha256', secret, body)}`)).toBe(
      true,
    );
    const store = memoryStore();
    await store.upsertConnection(sampleConnection({ selectedName: 'owner/repo' }));
    expect(await applyGithubWebhook(store, 'installation', 'delivery-1', JSON.parse(body))).toEqual(
      {
        duplicate: false,
        status: 'revoked',
      },
    );
    expect(await applyGithubWebhook(store, 'installation', 'delivery-1', JSON.parse(body))).toEqual(
      {
        duplicate: true,
      },
    );
    expect((await store.readConnection(owner, 'github'))?.status).toBe('revoked');
  });

  it('verifies Vercel signatures independently of GitHub HMAC', async () => {
    const body =
      '{"type":"integration-configuration.removed","payload":{"configuration":{"id":"icfg_1"}}}';
    const secret = 'vercel-webhook-secret-value';
    const digest = createHmac('sha1', secret).update(body).digest('hex');
    expect(verifyVercelSignature(secret, body, digest)).toBe(true);
    expect(verifyVercelSignature(secret, body, hmacHex('sha256', secret, body))).toBe(false);
    const store = memoryStore();
    await store.upsertConnection(
      sampleConnection({
        id: '22222222-2222-4222-8222-222222222222',
        provider: 'vercel',
        accountId: 'u1',
        installationId: 'icfg_1',
        selectedId: 'prj',
        selectedName: 'app',
      }),
    );
    await applyVercelWebhook(store, 'vercel', 'd1', JSON.parse(body));
    expect((await store.readConnection(owner, 'vercel'))?.status).toBe('revoked');
  });

  it('handles github_app_authorization.revoked from sender without an installation object', async () => {
    const body = JSON.stringify({
      action: 'revoked',
      sender: {
        login: 'octocat',
        id: 7,
        node_id: 'MDQ6VXNlcjc=',
        type: 'User',
        site_admin: false,
      },
    });
    expect(JSON.parse(body).installation).toBeUndefined();
    const store = memoryStore();
    await store.upsertConnection(sampleConnection());
    await store.putSecret(sampleConnection().id, 'sealed-user-token-value-xxxxx');
    expect(
      await applyGithubWebhook(store, 'github_app_authorization', 'delivery-auth-1', JSON.parse(body)),
    ).toEqual({
      duplicate: false,
      status: 'expired',
      kind: 'user_authorization_revoked',
    });
    expect(
      await applyGithubWebhook(store, 'github_app_authorization', 'delivery-auth-1', JSON.parse(body)),
    ).toEqual({ duplicate: true });
    const current = await store.readConnection(owner, 'github');
    expect(current?.status).toBe('expired');
    expect(current?.userAuthorization).toBe('revoked');
    expect(current?.installationId).toBe('42');
    expect(await store.takeSecret(sampleConnection().id)).toBeNull();
    expect(
      await applyGithubWebhook(store, 'installation', 'delivery-install-1', {
        action: 'deleted',
        installation: { id: 42 },
      }),
    ).toEqual({ duplicate: false, status: 'revoked' });
    expect((await store.readConnection(owner, 'github'))?.status).toBe('revoked');
  });
});
