import { z } from 'zod';
const schema = z.object({
  APP_ENV: z.enum(['local', 'preview', 'production']).optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).optional(),
  VERCEL: z.string().optional(),
  VERCEL_ENV: z.string().optional(),
  AURELIUS_DEV_HARNESS: z.enum(['true', 'false']).default('false'),
  AURELIUS_DEV_TOKEN: z.string().min(32).optional(),
  AURELIUS_FOUNDER_PASSWORD: z.string().min(16).optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(10).optional(),
});
export function isLoopback(url: string) {
  try {
    return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}
export function parseEnvironment(input: Record<string, string | undefined>) {
  const env = schema.parse(input);
  const mode =
    env.APP_ENV ??
    (env.NODE_ENV === 'development' && !env.VERCEL_ENV && !env.VERCEL ? 'local' : 'preview');
  const enabled = env.AURELIUS_DEV_HARNESS === 'true';
  if (env.VERCEL_ENV === 'production' && mode !== 'production')
    throw new Error('Production deployment requires APP_ENV=production');
  if ((env.VERCEL || env.VERCEL_ENV) && mode === 'local')
    throw new Error('Local mode is forbidden on hosted deployments');
  if (Boolean(env.NEXT_PUBLIC_SUPABASE_URL) !== Boolean(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY))
    throw new Error('Supabase URL and publishable key must be configured together');
  if (mode === 'production' && !env.NEXT_PUBLIC_SUPABASE_URL)
    throw new Error('Production requires Supabase configuration');
  if (
    enabled &&
    (mode !== 'local' ||
      env.NODE_ENV !== 'development' ||
      env.VERCEL ||
      env.VERCEL_ENV ||
      !env.AURELIUS_DEV_TOKEN ||
      !env.AURELIUS_FOUNDER_PASSWORD ||
      !env.NEXT_PUBLIC_SUPABASE_URL ||
      !isLoopback(env.NEXT_PUBLIC_SUPABASE_URL))
  )
    throw new Error('Developer harness is allowed only in explicitly configured local development');
  return { ...env, mode, harnessEnabled: enabled };
}
