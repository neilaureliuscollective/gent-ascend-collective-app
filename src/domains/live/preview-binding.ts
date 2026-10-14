import { parseEnvironment } from '@/platform/environment';
import { supabaseConnection } from '@/platform/supabase/connection';

// Target binding only. Shared canonical pilot requires explicit founder-only admission.
export const canonicalLiveProject = 'volpzkfsnmtztrovexcw';
const protectedProjects = new Set([canonicalLiveProject, 'tybjocxecilkmozkvuns']);

function liveMode(env: Record<string, string | undefined>) {
  try {
    return parseEnvironment(env).mode;
  } catch {
    return null;
  }
}

/** Production already pins Gent in supabaseConnection; the preview flag opts preview into that same project. */
function canonicalBindingAuthorized(env: Record<string, string | undefined>) {
  return env.AETHELIOS_LIVE_CANONICAL_PILOT === 'true' || liveMode(env) === 'production';
}

function liveConnection(env: Record<string, string | undefined>) {
  if (liveMode(env) === 'production') return supabaseConnection(env);
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return null;
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    key: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function previewBinding(env: Record<string, string | undefined>) {
  const canonicalAuthorized = canonicalBindingAuthorized(env);
  const reference =
    env.AETHELIOS_LIVE_PREVIEW_PROJECT_REF ??
    (canonicalAuthorized ? canonicalLiveProject : undefined);
  if (!reference) return 'not-configured' as const;
  if (!/^[a-z0-9]{20}$/.test(reference)) return 'invalid-reference' as const;
  if (
    protectedProjects.has(reference) &&
    !(canonicalAuthorized && reference === canonicalLiveProject)
  )
    return 'blocked-project' as const;
  try {
    const connection = liveConnection(env);
    const url = new URL(connection?.url ?? '');
    if (
      url.protocol !== 'https:' ||
      url.hostname !== `${reference}.supabase.co` ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      !connection?.key?.trim()
    )
      return 'url-mismatch' as const;
    return 'configuration-matched' as const;
  } catch {
    return 'url-mismatch' as const;
  }
}
