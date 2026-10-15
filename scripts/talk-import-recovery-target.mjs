/** Safety guards for the Talk Origin import-recovery runner. No hosted or application database. */

export const recoveryLoopbackHosts = ['127.0.0.1', 'localhost', '::1', '[::1]'];
export const recoveryPort = 54322;
export const recoveryMaintenanceDatabase = 'postgres';
export const defaultRecoveryDatabase = 'talk_import_recovery';

const forbiddenDatabases = new Set([
  'postgres',
  'template0',
  'template1',
  'supabase',
  'supabase_admin',
  'aurelius',
  'aurelius_og',
  'gent_ascend',
  'gentascend',
]);

function fail(message) {
  throw new Error(message);
}

export function quoteDisposableDatabase(name) {
  if (typeof name !== 'string' || !/^[a-z][a-z0-9_]{0,62}$/.test(name)) {
    fail(
      `Refusing disposable database name ${JSON.stringify(name)}. Use a lowercase identifier such as ${defaultRecoveryDatabase}.`,
    );
  }
  if (forbiddenDatabases.has(name) || /supabase|production|hosted|volpz|gentascend|aurelius/.test(name)) {
    fail(`Refusing to create or drop ${name}: that name is a system or application database.`);
  }
  return `"${name.replaceAll('"', '""')}"`;
}

export function recoveryTarget(env = process.env) {
  for (const key of [
    'DATABASE_URL',
    'SUPABASE_DB_URL',
    'SUPABASE_DB_URL_SESSION',
    'POSTGRES_URL',
    'POSTGRES_PRISMA_URL',
  ]) {
    const value = env[key];
    if (!value) continue;
    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      fail(`${key} is set but is not a valid URL. Refusing to continue.`);
    }
    const host = parsed.hostname;
    const port = Number(parsed.port || 5432);
    if (!recoveryLoopbackHosts.includes(host) || port !== recoveryPort) {
      fail(`${key} is not local Supabase PostgreSQL at loopback:${recoveryPort}. Refusing hosted or application targets.`);
    }
  }
  if (env.PGHOST && !recoveryLoopbackHosts.includes(env.PGHOST)) {
    fail(`PGHOST=${env.PGHOST} is not loopback. Refusing hosted or remote PostgreSQL.`);
  }
  if (env.PGPORT && Number(env.PGPORT) !== recoveryPort) {
    fail(`PGPORT=${env.PGPORT} is not ${recoveryPort}. Local Supabase PostgreSQL is required.`);
  }
  const host = env.TALK_IMPORT_RECOVERY_HOST || env.PGHOST || '127.0.0.1';
  const port = Number(env.TALK_IMPORT_RECOVERY_PORT || env.PGPORT || recoveryPort);
  const user = env.TALK_IMPORT_RECOVERY_USER || env.PGUSER || 'postgres';
  const database = env.TALK_IMPORT_RECOVERY_DB || defaultRecoveryDatabase;
  if (!recoveryLoopbackHosts.includes(host)) {
    fail(`Refusing non-loopback host ${host}. Recovery runs only on 127.0.0.1:${recoveryPort}.`);
  }
  if (port !== recoveryPort) {
    fail(`Refusing port ${port}. Recovery reuses local Supabase PostgreSQL ${recoveryPort} only.`);
  }
  if (!user || /[^\w]/.test(user)) {
    fail(`Refusing PostgreSQL user ${JSON.stringify(user)}.`);
  }
  return {
    host,
    port,
    user,
    password: env.TALK_IMPORT_RECOVERY_PASSWORD || env.PGPASSWORD || 'postgres',
    database,
    quotedDatabase: quoteDisposableDatabase(database),
    maintenanceDatabase: recoveryMaintenanceDatabase,
  };
}
