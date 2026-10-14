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
    // Official Vercel integration webhooks are HMAC-SHA1 signed with the
    // Integration Secret (client secret). Do not invent a separate webhook secret.
    webhookSecret: clientSecret.data,
    callback: `${host}/api/connections/vercel/callback`,
    webhook: `${host}/api/connections/webhooks/vercel`,
  };
}

export type SettingNameStatus = {
  name: string;
  present: boolean;
  valid: boolean;
};

function inspectSetting(name: string, raw: string | undefined, valid: boolean): SettingNameStatus {
  const present = Boolean(raw?.length);
  return { name, present, valid: present ? valid : false };
}

export function inspectGithubSettings(
  env: Record<string, string | undefined> = process.env,
): SettingNameStatus[] {
  const webhookRaw = env.GITHUB_APP_WEBHOOK_SECRET;
  return [
    inspectSetting(
      'NEXT_PUBLIC_APP_URL',
      env.NEXT_PUBLIC_APP_URL,
      Boolean(origin(env.NEXT_PUBLIC_APP_URL)),
    ),
    inspectSetting(
      'CONNECTIONS_CREDENTIAL_KEY',
      env.CONNECTIONS_CREDENTIAL_KEY,
      Boolean(connectionsCredentialKey(env)),
    ),
    inspectSetting('GITHUB_APP_ID', env.GITHUB_APP_ID, appId.safeParse(env.GITHUB_APP_ID).success),
    inspectSetting(
      'GITHUB_APP_SLUG',
      env.GITHUB_APP_SLUG,
      slug.safeParse(env.GITHUB_APP_SLUG).success,
    ),
    inspectSetting(
      'GITHUB_APP_CLIENT_ID',
      env.GITHUB_APP_CLIENT_ID,
      clientId.safeParse(env.GITHUB_APP_CLIENT_ID).success,
    ),
    inspectSetting(
      'GITHUB_APP_CLIENT_SECRET',
      env.GITHUB_APP_CLIENT_SECRET,
      secret.safeParse(env.GITHUB_APP_CLIENT_SECRET).success,
    ),
    inspectSetting(
      'GITHUB_APP_PRIVATE_KEY',
      env.GITHUB_APP_PRIVATE_KEY,
      Boolean(pem(env.GITHUB_APP_PRIVATE_KEY)),
    ),
    inspectSetting('GITHUB_APP_WEBHOOK_SECRET', webhookRaw, secret.safeParse(webhookRaw).success),
  ];
}

export function inspectVercelSettings(
  env: Record<string, string | undefined> = process.env,
): SettingNameStatus[] {
  return [
    inspectSetting(
      'NEXT_PUBLIC_APP_URL',
      env.NEXT_PUBLIC_APP_URL,
      Boolean(origin(env.NEXT_PUBLIC_APP_URL)),
    ),
    inspectSetting(
      'CONNECTIONS_CREDENTIAL_KEY',
      env.CONNECTIONS_CREDENTIAL_KEY,
      Boolean(connectionsCredentialKey(env)),
    ),
    inspectSetting(
      'VERCEL_INTEGRATION_SLUG',
      env.VERCEL_INTEGRATION_SLUG,
      slug.safeParse(env.VERCEL_INTEGRATION_SLUG).success,
    ),
    inspectSetting(
      'VERCEL_INTEGRATION_CLIENT_ID',
      env.VERCEL_INTEGRATION_CLIENT_ID,
      clientId.safeParse(env.VERCEL_INTEGRATION_CLIENT_ID).success,
    ),
    inspectSetting(
      'VERCEL_INTEGRATION_CLIENT_SECRET',
      env.VERCEL_INTEGRATION_CLIENT_SECRET,
      secret.safeParse(env.VERCEL_INTEGRATION_CLIENT_SECRET).success,
    ),
  ];
}

const GITHUB_CORE_NAMES = [
  'NEXT_PUBLIC_APP_URL',
  'CONNECTIONS_CREDENTIAL_KEY',
  'GITHUB_APP_ID',
  'GITHUB_APP_SLUG',
  'GITHUB_APP_CLIENT_ID',
  'GITHUB_APP_CLIENT_SECRET',
  'GITHUB_APP_PRIVATE_KEY',
] as const;

const VERCEL_CORE_NAMES = [
  'NEXT_PUBLIC_APP_URL',
  'CONNECTIONS_CREDENTIAL_KEY',
  'VERCEL_INTEGRATION_SLUG',
  'VERCEL_INTEGRATION_CLIENT_ID',
  'VERCEL_INTEGRATION_CLIENT_SECRET',
] as const;

export function describeProviderSetup(
  provider: 'github' | 'vercel',
  env: Record<string, string | undefined> = process.env,
  record: {
    accountLogin: string | null;
    selectedId: string | null;
    lastVerifiedAt: string | null;
    status: string;
    userAuthorization: string | null;
  } | null = null,
) {
  const settings = provider === 'github' ? inspectGithubSettings(env) : inspectVercelSettings(env);
  const core = provider === 'github' ? GITHUB_CORE_NAMES : VERCEL_CORE_NAMES;
  const missing = settings.filter((item) => !item.present).map((item) => item.name);
  const invalid = settings.filter((item) => item.present && !item.valid).map((item) => item.name);
  const configurationReady = core.every((name) => {
    const item = settings.find((entry) => entry.name === name);
    return Boolean(item?.present && item.valid);
  });
  const webhookReady =
    provider === 'github'
      ? settings.some(
          (item) => item.name === 'GITHUB_APP_WEBHOOK_SECRET' && item.present && item.valid,
        )
      : configurationReady;
  const accountAuthorized = Boolean(
    record &&
    record.accountLogin &&
    record.userAuthorization !== 'revoked' &&
    record.status !== 'setup_required',
  );
  const resourceVerified = Boolean(
    record &&
    record.status === 'connected' &&
    record.selectedId &&
    record.lastVerifiedAt &&
    record.userAuthorization !== 'revoked',
  );
  return {
    configurationReady,
    webhookReady,
    accountAuthorized,
    resourceVerified,
    missing,
    invalid,
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
