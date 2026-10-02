import { foundingTiers, type FoundingTier } from './founding-catalog';

export type BillingConfig = {
  secret: string;
  webhookSecret: string;
  origin: string;
  live: boolean;
  prices: Record<FoundingTier, string>;
  portal: string;
  recoveryPortal: string;
  enrollment: boolean;
  termsVersion: string;
  terms: string;
  taxMode: 'automatic' | 'none' | null;
  supportEmail: string | null;
};

/** Fail closed without making unconfigured public pages crash. Never send this object to a client. */
export function billingConfig(env: Record<string, string | undefined>): BillingConfig | null {
  const secret = env.STRIPE_SECRET_KEY ?? '';
  const live = secret.startsWith('sk_live_');
  const mode = env.APP_ENV ?? 'preview';
  if (
    !['local', 'preview', 'production'].includes(mode) ||
    (mode === 'local' && (env.VERCEL || env.VERCEL_ENV))
  )
    return null;
  if (!live && !secret.startsWith('sk_test_')) return null;
  if (live !== (mode === 'production')) return null;
  if (env.VERCEL_ENV === 'production' && mode !== 'production') return null;
  if (!env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_')) return null;
  if (
    !env.SUPABASE_SERVICE_ROLE_KEY ||
    !env.NEXT_PUBLIC_SUPABASE_URL ||
    !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    return null;
  // Test billing must never overwrite the dedicated production membership project.
  if (
    !live &&
    env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '') === 'https://volpzkfsnmtztrovexcw.supabase.co'
  )
    return null;
  let url: URL;
  try {
    url = new URL(env.BILLING_APP_ORIGIN ?? '');
  } catch {
    return null;
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') return null;
  if (
    url.protocol !== 'https:' &&
    !(mode === 'local' && local && !env.VERCEL && url.protocol === 'http:')
  )
    return null;
  if (live && local) return null;
  const prices = Object.fromEntries(
    foundingTiers.map((tier) => [tier, env[`STRIPE_PRICE_${tier.toUpperCase()}`] ?? '']),
  ) as Record<FoundingTier, string>;
  if (
    Object.values(prices).some((value) => !/^price_[A-Za-z0-9]+$/.test(value)) ||
    new Set(Object.values(prices)).size !== 3
  )
    return null;
  const portal = env.STRIPE_PORTAL_CONFIGURATION ?? '';
  if (!/^bpc_[A-Za-z0-9]+$/.test(portal)) return null;
  const recoveryPortal = env.STRIPE_PORTAL_RECOVERY_CONFIGURATION ?? '';
  if (!/^bpc_[A-Za-z0-9]+$/.test(recoveryPortal) || recoveryPortal === portal) return null;
  const termsVersion = env.FOUNDING_TERMS_VERSION ?? '';
  const terms = env.FOUNDING_TERMS_TEXT ?? '';
  const taxMode =
    env.BILLING_TAX_MODE === 'automatic'
      ? 'automatic'
      : env.BILLING_TAX_MODE === 'none'
        ? 'none'
        : null;
  const supportEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.MEMBERSHIP_SUPPORT_EMAIL ?? '')
    ? env.MEMBERSHIP_SUPPORT_EMAIL!
    : null;
  return {
    secret,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    origin: url.origin,
    live,
    prices,
    portal,
    recoveryPortal,
    enrollment:
      env.STRIPE_CHECKOUT_ENABLED === 'true' &&
      env.FOUNDING_LAUNCH_APPROVED === 'true' &&
      termsVersion.length > 0 &&
      termsVersion.length <= 100 &&
      terms.length >= 100 &&
      terms.length <= 20000 &&
      taxMode !== null &&
      supportEmail !== null,
    termsVersion,
    terms,
    taxMode,
    supportEmail,
  };
}
