export function registrationConfig(env: Record<string, string | undefined>) {
  if (
    env.MEMBERSHIP_SIGNUP_ENABLED !== 'true' ||
    env.MEMBERSHIP_AUTH_READY !== 'true' ||
    !env.NEXT_PUBLIC_SUPABASE_URL ||
    !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    return null;
  let url: URL;
  try {
    url = new URL(env.BILLING_APP_ORIGIN ?? '');
  } catch {
    return null;
  }
  const local =
    env.APP_ENV === 'local' &&
    !env.VERCEL &&
    !env.VERCEL_ENV &&
    ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/' ||
    (!local && url.protocol !== 'https:') ||
    (local && !['https:', 'http:'].includes(url.protocol))
  )
    return null;
  const siteKey = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
  if (!local && !siteKey) return null;
  return { origin: url.origin, siteKey, captchaRequired: !local || !!siteKey };
}
