/** Only explicitly configured HTTPS origins; no guessed domains or shared session tokens. */
export function ecosystemOrigin(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      !url.hostname.includes('.') ||
      /^(localhost|127\.|0\.)/.test(url.hostname)
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}
