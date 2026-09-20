import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
if (process.env.VERCEL || process.env.VERCEL_ENV || process.env.APP_ENV === 'production')
  throw new Error('Local bootstrap only');
for (const file of ['.env', '.env.local', '.env.development', '.env.development.local']) {
  if (existsSync(file)) {
    const content = readFileSync(file, 'utf8');
    if (
      /APP_ENV=(preview|production)/.test(content) ||
      /NEXT_PUBLIC_SUPABASE_URL=(?!http:\/\/(127\.0\.0\.1|localhost):)/.test(content)
    )
      throw new Error('Refusing to overwrite or use non-local configuration');
  }
}
if (!process.argv.includes('--running'))
  execFileSync('npx', ['--no-install', 'supabase', 'start'], { stdio: 'inherit' });
const status = JSON.parse(
  execFileSync('npx', ['--no-install', 'supabase', 'status', '-o', 'json'], { encoding: 'utf8' }),
);
if (!['127.0.0.1', 'localhost'].includes(new URL(status.API_URL).hostname))
  throw new Error('Local Supabase required');
const password = randomBytes(32).toString('base64url');
const token = randomBytes(32).toString('base64url');
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
for (const id of ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002']) {
  const { error } = await admin.auth.admin.updateUserById(id, { password, email_confirm: true });
  if (error) throw new Error('Local seed identity missing; run npm run db:reset. ' + error.message);
}
writeFileSync(
  '.env.development.local',
  `APP_ENV=local
AURELIUS_DEV_HARNESS=true
AURELIUS_DEV_TOKEN=${token}
AURELIUS_FOUNDER_PASSWORD=${password}
NEXT_PUBLIC_SUPABASE_URL=${status.API_URL}
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${status.PUBLISHABLE_KEY ?? status.ANON_KEY}
`,
  { mode: 0o600 },
);
chmodSync('.env.development.local', 0o600);
console.log(
  'Local founder provisioned. Run npm run dev; open http://127.0.0.1:3000/dev. Copy AURELIUS_DEV_TOKEN from .env.development.local into the local entry form. Never share that file.',
);
