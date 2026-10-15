export type StudioProviderState =
  | 'implemented'
  | 'configuration required'
  | 'disabled'
  | 'awaiting approval'
  | 'working'
  | 'failed'
  | 'uncertain'
  | 'saved'
  | 'unavailable';

export function studioProviderStates(env: Record<string, string | undefined>) {
  const openai = Boolean(env.OPENAI_API_KEY);
  return {
    imageGeneration: openai ? ('configuration required' satisfies StudioProviderState) : 'disabled',
    narration: env.STUDIO_NARRATION_ENABLED === 'true' ? 'implemented' : 'disabled',
    footage: env.STUDIO_FOOTAGE_ENABLED === 'true' ? 'implemented' : 'disabled',
    designEditor: 'implemented' as const,
    designExport: 'implemented' as const,
    filmPreview: 'implemented' as const,
    filmRenderLocal: 'implemented' as const,
    filmRenderHosted: 'unavailable' as const,
    prepressCmyk: 'unavailable' as const,
  };
}
