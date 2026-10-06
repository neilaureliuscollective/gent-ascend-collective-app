/** No guessed destination. Set only after verifying Legacy Reserve's own experience. */
export function legacyReserveDestination(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash
    )
      return null;
    if (
      url.hostname === 'localhost' ||
      !url.hostname.includes('.') ||
      /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
