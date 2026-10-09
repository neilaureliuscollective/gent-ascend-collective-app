import { parseEnvironment } from '@/platform/environment';
export function creationRuntime(input: Record<string, string | undefined>) {
  const env = parseEnvironment(input);
  if (env.mode === 'production' || env.VERCEL_ENV === 'production') return null;
  const hostname = env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname
    : '';
  const ref =
    hostname.match(/^([a-z]{20})\.supabase\.co$/)?.[1] ??
    (['127.0.0.1', 'localhost', '[::1]'].includes(hostname) ? 'local' : null);
  return {
    contract: 'public-creation-runtime-v1' as const,
    mode: env.mode,
    projectRef: ref,
    commit: /^[a-f0-9]{40}$/.test(input.CREATION_BUILD_COMMIT ?? '')
      ? input.CREATION_BUILD_COMMIT
      : null,
    harnessEnabled: env.harnessEnabled,
  };
}
