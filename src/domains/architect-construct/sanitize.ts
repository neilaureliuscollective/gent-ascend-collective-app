const secretPattern =
  /(OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|ARCHITECT_CONSTRUCT_WORKER_TOKEN|ARCHITECT_APPS_PREVIEW_SECRET|CRON_SECRET|AURELIUS_DEV_TOKEN|AWS_SECRET_ACCESS_KEY|sk-[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._~+/-]+=*)/gi;

export function sanitizeLog(value: string, extra: string[] = [], max = 16384) {
  let text = value.replace(secretPattern, '[redacted]');
  for (const secret of extra) {
    if (secret.length >= 8) text = text.split(secret).join('[redacted]');
  }
  return text.replace(/\u0000/g, '').slice(0, max);
}

export function strippedEnv(home: string): NodeJS.ProcessEnv {
  const nodeDir = process.execPath.includes('/')
    ? process.execPath.slice(0, process.execPath.lastIndexOf('/'))
    : '/usr/bin';
  return {
    PATH: `${nodeDir}:/usr/local/bin:/usr/bin:/bin`,
    HOME: home,
    LANG: 'C',
    NODE_ENV: 'test',
    NODE_OPTIONS: '',
  };
}

export function assertNoHostSecrets(env: NodeJS.ProcessEnv) {
  const leaked = [
    'OPENAI_API_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'ARCHITECT_CONSTRUCT_WORKER_TOKEN',
    'ARCHITECT_APPS_PREVIEW_SECRET',
    'CRON_SECRET',
    'AURELIUS_DEV_TOKEN',
    'AWS_SECRET_ACCESS_KEY',
  ].filter((key) => env[key]);
  if (leaked.length) throw new Error(`Host secrets must not enter execution: ${leaked.join(', ')}`);
}
