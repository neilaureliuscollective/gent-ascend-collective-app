import { parseEnvironment } from '@/platform/environment';
import { previewBinding } from './preview-binding';
import { expiryReadiness } from './expiry-readiness';

/** Configuration is necessary, never evidence of hosted acceptance or user authority. */
export function liveAdmissionPolicy(env: Record<string, string | undefined>) {
  const { mode } = parseEnvironment(env);
  const canonicalPilot = env.AETHELIOS_LIVE_CANONICAL_PILOT === 'true';
  const founderOnly = mode === 'production' || (mode === 'preview' && canonicalPilot);
  let error: string | null = null;
  if (
    env.AETHELIOS_LIVE_ENABLED !== 'true' ||
    (mode === 'production' && env.AETHELIOS_LIVE_FOUNDER_PILOT !== 'true')
  )
    error = 'Aethelios Live is not enabled on this deployment.';
  else if (mode !== 'local' && env.AETHELIOS_LIVE_CONTROL_READY !== 'true')
    error = 'Voice hosting controls have not been verified for this deployment.';
  else if (
    mode !== 'local' &&
    (previewBinding(env) !== 'configuration-matched' ||
      (mode === 'production' &&
        (!canonicalPilot ||
          new URL(env.NEXT_PUBLIC_SUPABASE_URL!).hostname !== 'volpzkfsnmtztrovexcw.supabase.co')))
  )
    error = 'The voice database binding is missing or unsafe.';
  else if (mode !== 'local' && !expiryReadiness(env).configured)
    error = 'Independent voice cleanup is not configured for this deployment.';
  return { mode, founderOnly, error };
}
