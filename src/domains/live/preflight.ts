import { z } from 'zod';
import { parseEnvironment } from '@/platform/environment';
import { liveModels } from './diagnostics';
import { previewBinding } from './preview-binding';
import { expiryReadiness } from './expiry-readiness';
import { liveAdmissionPolicy } from './admission-policy';
export const preflightProbe = z.object({ checkProvider: z.literal(true) }).strict();
export function preflightConfiguration(env: Record<string, string | undefined>) {
  let environment: 'local' | 'preview' | 'production' | 'invalid' = 'invalid';
  try {
    environment = parseEnvironment(env).mode;
  } catch {
    /* Do not expose validation errors or raw values. */
  }
  const candidate = env.AETHELIOS_LIVE_MODEL ?? 'gpt-realtime';
  const model = liveModels.find((value) => value === candidate) ?? null;
  const keyConfigured = !!env.OPENAI_API_KEY?.trim();
  const enabled = env.AETHELIOS_LIVE_ENABLED === 'true';
  const controlsDeclared = env.AETHELIOS_LIVE_CONTROL_READY === 'true';
  const source = /^[a-f0-9]{40}$/i.test(env.VERCEL_GIT_COMMIT_SHA ?? '')
    ? env.VERCEL_GIT_COMMIT_SHA!
    : null;
  return {
    environment,
    source,
    model,
    keyConfigured,
    enabled,
    controlsDeclared,
    previewDatabaseBinding: previewBinding(env),
    canonicalPilot: environment !== 'invalid' && liveAdmissionPolicy(env).founderOnly,
    admissionConfigured:
      environment !== 'invalid' && keyConfigured && !!model && !liveAdmissionPolicy(env).error,
    launchAcceptance: 'unverified' as const,
    expiry: {
      ...expiryReadiness(env),
      databaseConnectionConfigured:
        environment === 'production' ||
        (!!env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
          !!env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()),
      scheduleAcceptance: 'unverified' as const,
      providerCleanupAcceptance: 'unverified' as const,
    },
  };
}
export type ProviderPreflight = {
  status:
    | 'not-checked'
    | 'missing-key'
    | 'unsupported-model'
    | 'metadata-accessible'
    | 'credential-rejected'
    | 'metadata-forbidden'
    | 'model-not-found'
    | 'rate-limited'
    | 'provider-error'
    | 'network-error'
    | 'invalid-response';
  durationMs: number | null;
};
export type PreflightReport = ReturnType<typeof preflightConfiguration> & {
  checkedAt: string;
  provider: ProviderPreflight;
  schema: { name: string; status: 'readable' | 'unavailable' }[];
};
