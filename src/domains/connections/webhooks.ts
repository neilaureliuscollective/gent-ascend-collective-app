import { createHmac, timingSafeEqual } from 'node:crypto';
import { githubAppConfig, vercelIntegrationConfig } from './config';
import { ConnectionError } from './errors';
import { hmacHex } from './crypto';
import { record } from './http';
import type { ConnectionStatus } from './schema';
import type { ConnectionStore } from './store';

function match(expected: string, actual: string) {
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyGithubSignature(secret: string, body: string, header: string | null) {
  if (!header || !header.startsWith('sha256=')) return false;
  const expected = `sha256=${hmacHex('sha256', secret, body)}`;
  return match(expected, header);
}

export function verifyVercelSignature(secret: string, body: string, header: string | null) {
  if (!header) return false;
  const digest = createHmac('sha1', secret).update(body).digest('hex');
  return match(digest, header);
}

export async function applyGithubWebhook(
  store: ConnectionStore,
  event: string,
  delivery: string,
  payload: unknown,
) {
  if (!(await store.recordEvent('github', delivery))) return { duplicate: true };
  const body = record(payload);
  const installation = record(body.installation);
  const installationId =
    typeof installation.id === 'number'
      ? String(installation.id)
      : typeof body.installation_id === 'number'
        ? String(body.installation_id)
        : null;
  if (!installationId) return { duplicate: false, ignored: true };
  let status: ConnectionStatus | null = null;
  let error: string | null = null;
  if (event === 'installation' && body.action === 'deleted') {
    status = 'revoked';
    error = 'The GitHub App installation was removed.';
  } else if (event === 'github_app_authorization' && body.action === 'revoked') {
    status = 'revoked';
    error = 'GitHub user authorization was revoked.';
  } else if (event === 'installation_repositories' && body.action === 'removed') {
    status = 'degraded';
    error = 'Repository access was removed from the GitHub installation.';
  }
  if (status) await store.applyProviderStatus('github', installationId, status, error);
  return { duplicate: false, status };
}

export async function applyVercelWebhook(
  store: ConnectionStore,
  event: string,
  delivery: string,
  payload: unknown,
) {
  if (!(await store.recordEvent('vercel', delivery))) return { duplicate: true };
  const body = record(payload);
  const configurationId =
    typeof body.payload === 'object'
      ? typeof record(record(body.payload).configuration).id === 'string'
        ? String(record(record(body.payload).configuration).id)
        : typeof body.configurationId === 'string'
          ? body.configurationId
          : typeof record(body.payload).configurationId === 'string'
            ? String(record(body.payload).configurationId)
            : null
      : typeof body.configurationId === 'string'
        ? body.configurationId
        : null;
  const type = typeof body.type === 'string' ? body.type : event;
  if (!configurationId) return { duplicate: false, ignored: true };
  if (type === 'integration-configuration.removed' || type === 'integration.uninstalled') {
    await store.applyProviderStatus(
      'vercel',
      configurationId,
      'revoked',
      'The Vercel integration was uninstalled.',
    );
    return { duplicate: false, status: 'revoked' as const };
  }
  return { duplicate: false, ignored: true };
}

export function githubWebhookConfig(env: Record<string, string | undefined> = process.env) {
  const config = githubAppConfig(env);
  if (!config?.webhookSecret)
    throw new ConnectionError(
      'GitHub webhook verification is not configured.',
      503,
      'setup_required',
    );
  return config;
}

export function vercelWebhookConfig(env: Record<string, string | undefined> = process.env) {
  const config = vercelIntegrationConfig(env);
  if (!config?.webhookSecret)
    throw new ConnectionError(
      'Vercel webhook verification is not configured.',
      503,
      'setup_required',
    );
  return config;
}
