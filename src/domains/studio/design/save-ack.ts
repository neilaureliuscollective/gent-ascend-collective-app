export function acknowledgedSave(input: {
  requestSeq: number;
  latestSeq: number;
  requestId: string;
  currentId: string | null;
  serverRevision: number;
  serverUpdatedAt: string;
}) {
  if (!input.currentId || input.currentId !== input.requestId) {
    return { apply: false as const };
  }
  return {
    apply: true as const,
    keepLocalEdits: input.requestSeq !== input.latestSeq,
    revision: input.serverRevision,
    updatedAt: input.serverUpdatedAt,
  };
}
