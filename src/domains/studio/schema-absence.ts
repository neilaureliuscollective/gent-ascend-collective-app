export const STUDIO_SCHEMA_ABSENCE_CODES = ['42P01', '42703', 'PGRST205', 'PGRST204'] as const;

export function missingStudioSchema(error: { code?: string } | null | undefined) {
  return Boolean(error && error.code && (STUDIO_SCHEMA_ABSENCE_CODES as readonly string[]).includes(error.code));
}

export function allStudioProductionTablesMissing(
  designs: { code?: string } | null | undefined,
  compositions: { code?: string } | null | undefined,
  renders: { code?: string } | null | undefined,
) {
  return missingStudioSchema(designs) && missingStudioSchema(compositions) && missingStudioSchema(renders);
}
