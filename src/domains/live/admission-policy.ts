import { parseEnvironment } from '@/platform/environment';
import { canonicalLiveProject, previewBinding } from './preview-binding';
import { expiryReadiness } from './expiry-readiness';
import { liveModels } from './diagnostics';

/** Configuration is necessary, never evidence of hosted acceptance or user authority. */
export function liveAdmissionPolicy(env: Record<string, string | undefined>) {
  let mode: 'local' | 'preview' | 'production' | 'invalid' = 'invalid';
  try {
    mode = parseEnvironment(env).mode;
  } catch {
    return {
      mode: 'invalid' as const,
      founderOnly: true,
      error: 'Aethelios Live is not enabled on this deployment.',
    };
  }
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
      productionHostUnsafe(mode, canonicalPilot, env))
  )
    error = 'The voice database binding is missing or unsafe.';
  else if (mode !== 'local' && !expiryReadiness(env).configured)
    error = 'Independent voice cleanup is not configured for this deployment.';
  return { mode, founderOnly, error };
}

function productionHostUnsafe(
  mode: 'local' | 'preview' | 'production' | 'invalid',
  canonicalPilot: boolean,
  env: Record<string, string | undefined>,
) {
  if (mode !== 'production') return false;
  if (!canonicalPilot) return true;
  try {
    return (
      new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname !== `${canonicalLiveProject}.supabase.co`
    );
  } catch {
    return true;
  }
}

/** Server-rendered Talk/shell admission. Never treats a flag as launch acceptance. */
export function liveShellAvailability(env: Record<string, string | undefined>, founder: boolean) {
  const policy = liveAdmissionPolicy(env);
  if (policy.founderOnly && !founder)
    return {
      enabled: false,
      founderOnly: true as const,
      reason: 'This voice pilot is limited to the founder account.',
    };
  if (policy.error)
    return { enabled: false, founderOnly: policy.founderOnly, reason: policy.error };
  const model = liveModels.find((value) => value === (env.AETHELIOS_LIVE_MODEL ?? 'gpt-realtime'));
  if (!env.OPENAI_API_KEY?.trim() || !model)
    return {
      enabled: false,
      founderOnly: policy.founderOnly,
      reason: 'The voice connection is not configured.',
    };
  return { enabled: true, founderOnly: policy.founderOnly, reason: null };
}
