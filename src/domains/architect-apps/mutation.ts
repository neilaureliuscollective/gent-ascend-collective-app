export const MUTATION_CONFLICT = 'This operation identity already saved a different record. Request a new mutation identity.';
export const VERSION_CONFLICT = 'Record changed. Reload before saving this edit.';

export class MutationConflictError extends Error {
  readonly code = 'conflict' as const;
}

export function mutationPayloadEquals(left: Record<string, unknown>, right: Record<string, unknown>) {
  return stableMutationJson(left) === stableMutationJson(right);
}

export function stableMutationJson(payload: Record<string, unknown>) {
  const keys = Object.keys(payload)
    .filter((key) => key !== 'persisted' && key !== 'version')
    .sort();
  const next: Record<string, unknown> = {};
  for (const key of keys) next[key] = payload[key];
  return JSON.stringify(next);
}

export function assertReplayPayload(
  stored: Record<string, unknown>,
  incoming: Record<string, unknown>,
) {
  if (!mutationPayloadEquals(stored, incoming)) throw new MutationConflictError(MUTATION_CONFLICT);
}

export function assertExpectedVersion(actual: number, expected?: number) {
  if (expected == null) return;
  if (actual !== expected) throw new MutationConflictError(VERSION_CONFLICT);
}
