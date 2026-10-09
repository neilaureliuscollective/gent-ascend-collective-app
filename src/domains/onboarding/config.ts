export function accountConfig(
  env: Record<string, string | undefined>,
  options: { returning?: boolean } = {},
) {
  if (
    (!options.returning && env.ACCOUNT_SIGNUP_ENABLED !== 'true') ||
    env.ACCOUNT_AUTH_READY !== 'true' ||
    !env.NEXT_PUBLIC_SUPABASE_URL ||
    !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    return null;
  let origin: URL;
  try {
    origin = new URL(env.ACCOUNT_APP_ORIGIN ?? '');
  } catch {
    return null;
  }
  const local =
    env.APP_ENV === 'local' &&
    !env.VERCEL &&
    !env.VERCEL_ENV &&
    ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
  if (
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash ||
    (!local && origin.protocol !== 'https:') ||
    (local && !['http:', 'https:'].includes(origin.protocol))
  )
    return null;
  const siteKey = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
  if (!local && !siteKey) return null;
  return {
    origin: origin.origin,
    siteKey,
    captchaRequired: !local || !!siteKey,
    google: env.ACCOUNT_GOOGLE_READY === 'true',
  };
}
