import { describe, expect, it } from 'vitest';
import { hmacHex } from '../src/domains/connections/crypto';
import { memoryStore } from '../src/domains/connections/store';
import {
  applyGithubWebhook,
  applyVercelWebhook,
  verifyGithubSignature,
  verifyVercelSignature,
} from '../src/domains/connections/webhooks';
import { owner } from './connections-support';
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
    await store.upsertConnection({
      id: '11111111-1111-4111-8111-111111111111',
      personId: owner,
      provider: 'github',
      status: 'connected',
      accountLogin: 'neil',
      accountId: '7',
      installationId: '42',
      selectedId: '99',
      selectedName: 'owner/repo',
      capabilities: {},
      lastVerifiedAt: new Date().toISOString(),
      lastError: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
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
    await store.upsertConnection({
      id: '22222222-2222-4222-8222-222222222222',
      personId: owner,
      provider: 'vercel',
      status: 'connected',
      accountLogin: 'neil',
      accountId: 'u1',
      installationId: 'icfg_1',
      selectedId: 'prj',
      selectedName: 'app',
      capabilities: {},
      lastVerifiedAt: new Date().toISOString(),
      lastError: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await applyVercelWebhook(store, 'vercel', 'd1', JSON.parse(body));
    expect((await store.readConnection(owner, 'vercel'))?.status).toBe('revoked');
  });
});
