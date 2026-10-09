export function supportEmail(env: Record<string, string | undefined>) {
  const email = env.GENT_SUPPORT_EMAIL ?? env.MEMBERSHIP_SUPPORT_EMAIL ?? '';
  return email.length <= 254 && /^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)
    ? email
    : null;
}
