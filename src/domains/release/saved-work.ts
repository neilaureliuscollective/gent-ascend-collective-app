export const savedWorkRelations = [
  'intelligence_missions',
  'mission_proposals',
  'mission_studio_links',
  'mission_outputs',
  'mission_turn_context',
  'mission_deliverables',
  'mission_deliverable_versions',
  'mission_deliverable_summaries',
] as const;

export type SavedWorkRelation = (typeof savedWorkRelations)[number];
export type SavedWorkStatus = 'accessible' | 'unavailable' | 'denied' | 'unknown';
export type SavedWorkReport = {
  checkedAt: string;
  checks: { relation: SavedWorkRelation; status: SavedWorkStatus }[];
};

// Only bounded status categories leave the server. A readable relation does not
// prove its policies, functions, ownership isolation, or provider acceptance.
export function savedWorkStatus(result: {
  status: number;
  error: { code?: string } | null;
}): SavedWorkStatus {
  if (!result.error && result.status >= 200 && result.status < 300) return 'accessible';
  if (result.status === 401 || result.status === 403 || result.error?.code === '42501')
    return 'denied';
  if (result.status === 404 || ['42P01', '42703', 'PGRST205'].includes(result.error?.code ?? ''))
    return 'unavailable';
  return 'unknown';
}
