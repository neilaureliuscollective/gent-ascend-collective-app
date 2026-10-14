// Ephemeral loopback-only service role from `supabase status`. Never logs the key.
import { execFileSync } from 'node:child_process';

export function localSupabaseControlPlane() {
  if (
    process.env.VERCEL ||
    process.env.VERCEL_ENV ||
    ['production', 'preview'].includes(process.env.APP_ENV ?? '')
  )
    throw new Error('Local control plane only');
  const status = JSON.parse(
    execFileSync('npx', ['--no-install', 'supabase', 'status', '-o', 'json'], { encoding: 'utf8' }),
  );
  const url = status.API_URL;
  const serviceRoleKey = status.SERVICE_ROLE_KEY;
  if (!url || !['127.0.0.1', 'localhost'].includes(new URL(url).hostname))
    throw new Error('Loopback Supabase required for the Construct control plane.');
  if (!serviceRoleKey) throw new Error('Local service role is unavailable from supabase status.');
  return {
    url,
    serviceRoleKey,
    publishableKey: status.PUBLISHABLE_KEY ?? status.ANON_KEY,
  };
}
