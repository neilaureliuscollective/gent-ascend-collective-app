/** Configuration only: never proves scheduled delivery or provider termination. */
export function expiryReadiness(env: Record<string, string | undefined>) {
  const enabled = env.AETHELIOS_LIVE_EXPIRY_ENABLED === 'true';
  const workerCredentialConfigured = !!env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const schedulerSecretConfigured = (env.CRON_SECRET?.trim().length ?? 0) >= 32;
  return {
    enabled,
    workerCredentialConfigured,
    schedulerSecretConfigured,
    configured: enabled && workerCredentialConfigured && schedulerSecretConfigured,
  };
}
