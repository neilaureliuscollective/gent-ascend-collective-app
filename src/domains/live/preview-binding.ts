// Configuration check only. Actual isolated ownership/schema still require hosted acceptance.
const protectedProjects = new Set(['volpzkfsnmtztrovexcw', 'tybjocxecilkmozkvuns']);
export function previewBinding(env: Record<string, string | undefined>) {
  const reference = env.AETHELIOS_LIVE_PREVIEW_PROJECT_REF;
  if (!reference) return 'not-configured' as const;
  if (!/^[a-z0-9]{20}$/.test(reference)) return 'invalid-reference' as const;
  if (protectedProjects.has(reference)) return 'blocked-project' as const;
  try {
    const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? '');
    if (
      url.protocol !== 'https:' ||
      url.hostname !== `${reference}.supabase.co` ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
    )
      return 'url-mismatch' as const;
    return 'configuration-matched' as const;
  } catch {
    return 'url-mismatch' as const;
  }
}
