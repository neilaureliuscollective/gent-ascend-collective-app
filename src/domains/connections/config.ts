import { z } from 'zod';
import { ConnectionError } from './errors';

const originSchema = z.url().max(200);
const hexKey = z.string().regex(/^[a-f0-9]{64}$/i);
const slug = z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/);
const appId = z.string().regex(/^[0-9]{1,12}$/);
const clientId = z.string().regex(/^[A-Za-z0-9._-]{8,80}$/);
const secret = z.string().min(16).max(400);

function origin(raw: string | undefined) {
  const parsed = originSchema.safeParse(raw);
  if (!parsed.success) return null;
  const url = new URL(parsed.data);
  if (
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    !['http:', 'https:'].includes(url.protocol)
  )
    return null;
  if (url.protocol === 'http:' && !['127.0.0.1', 'localhost'].includes(url.hostname)) return null;
  return url.origin;
}

function pem(raw: string | undefined) {
  if (!raw) return null;
  const value = raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw;
  if (
    !value.includes('BEGIN') ||
    !value.includes('PRIVATE KEY') ||
    value.length < 80 ||
    value.length > 12000
  )
    return null;
  return value;
}

export function connectionsCredentialKey(env: Record<string, string | undefined> = process.env) {
  const parsed = hexKey.safeParse(env.CONNECTIONS_CREDENTIAL_KEY);
  return parsed.success ? parsed.data : null;
}

export function appOrigin(env: Record<string, string | undefined> = process.env) {
  return origin(env.NEXT_PUBLIC_APP_URL);
}

export function githubAppConfig(env: Record<string, string | undefined> = process.env) {
  const key = connectionsCredentialKey(env);
  const host = appOrigin(env);
  const id = appId.safeParse(env.GITHUB_APP_ID);
  const client = clientId.safeParse(env.GITHUB_APP_CLIENT_ID);
  const slugValue = slug.safeParse(env.GITHUB_APP_SLUG);
  const privateKey = pem(env.GITHUB_APP_PRIVATE_KEY);
  const clientSecret = secret.safeParse(env.GITHUB_APP_CLIENT_SECRET);
  if (!key || !host || !id.success || !client.success || !slugValue.success || !privateKey)
    return null;
  if (!clientSecret.success) return null;
  return {
    key,
    origin: host,
    appId: id.data,
    clientId: client.data,
    clientSecret: clientSecret.data,
    slug: slugValue.data,
    privateKey,
    webhookSecret: env.GITHUB_APP_WEBHOOK_SECRET?.length
      ? secret.safeParse(env.GITHUB_APP_WEBHOOK_SECRET).success
        ? env.GITHUB_APP_WEBHOOK_SECRET
        : null
      : null,
    setup: `${host}/api/connections/github/setup`,
    callback: `${host}/api/connections/github/callback`,
    webhook: `${host}/api/connections/webhooks/github`,
  };
}

export function vercelIntegrationConfig(env: Record<string, string | undefined> = process.env) {
  const key = connectionsCredentialKey(env);
  const host = appOrigin(env);
  const client = clientId.safeParse(env.VERCEL_INTEGRATION_CLIENT_ID);
  const clientSecret = secret.safeParse(env.VERCEL_INTEGRATION_CLIENT_SECRET);
  const slugValue = slug.safeParse(env.VERCEL_INTEGRATION_SLUG);
  if (!key || !host || !client.success || !clientSecret.success || !slugValue.success) return null;
  return {
    key,
    origin: host,
    clientId: client.data,
    clientSecret: clientSecret.data,
    slug: slugValue.data,
    webhookSecret: env.VERCEL_INTEGRATION_WEBHOOK_SECRET?.length
      ? secret.safeParse(env.VERCEL_INTEGRATION_WEBHOOK_SECRET).success
        ? env.VERCEL_INTEGRATION_WEBHOOK_SECRET
        : null
      : null,
    callback: `${host}/api/connections/vercel/callback`,
    webhook: `${host}/api/connections/webhooks/vercel`,
  };
}

export function requireGithubConfig(env: Record<string, string | undefined> = process.env) {
  const config = githubAppConfig(env);
  if (!config)
    throw new ConnectionError(
      'GitHub App registration and server secrets are required before connecting.',
      503,
      'setup_required',
    );
  return config;
}

export function requireVercelConfig(env: Record<string, string | undefined> = process.env) {
  const config = vercelIntegrationConfig(env);
  if (!config)
    throw new ConnectionError(
      'Vercel integration registration and server secrets are required before connecting.',
      503,
      'setup_required',
    );
  return config;
}

export function flowCookieName(secure: boolean) {
  return secure ? '__Host-aethelios-cx-flow' : 'aethelios-cx-flow';
}
