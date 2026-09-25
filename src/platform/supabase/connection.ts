import { parseEnvironment } from '../environment';

// The dedicated production project is part of this application's public identity.
// Both values are publishable client configuration, never a service-role secret.
// Keep production pinned while the Vercel project has stale environment variables.
const production = {
  url: 'https://volpzkfsnmtztrovexcw.supabase.co',
  key: 'sb_publishable_Y2AteFS-YtROjZNGt_GGyw_VeXPQ6j8',
};

export function supabaseConnection(input: Record<string, string | undefined>) {
  const env = parseEnvironment(input);
  if (env.mode === 'production') return production;
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return null;
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    key: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}
