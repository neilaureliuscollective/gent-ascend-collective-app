/** Only public product handles. No identity, preferences, or health details. */
export function parseSavedSelection(raw: string | null): string[] {
  if (!raw || raw.length > 20000) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return [
      ...new Set(
        value.filter(
          (handle): handle is string =>
            typeof handle === 'string' && /^[a-z0-9-]{1,120}$/.test(handle),
        ),
      ),
    ].slice(0, 100);
  } catch {
    return [];
  }
}
