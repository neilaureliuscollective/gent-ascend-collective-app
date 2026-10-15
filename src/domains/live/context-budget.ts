export type SeedMessage = { role: string; content: unknown };

export function budgetLiveSeed(
  application: SeedMessage[],
  history: SeedMessage[],
  historyLimit: number,
) {
  const pinned = application.filter(
    (message) => typeof message.content === 'string' && message.content,
  );
  // Application context is never silently truncated. Fail before paid admission if it is too large.
  const pinnedLength = pinned.reduce((size, message) => size + String(message.content).length, 0);
  if (
    pinned.length > 8 ||
    pinnedLength > 48000 ||
    pinned.some((message) => String(message.content).length > 32000)
  )
    throw new RangeError('Live application context exceeds the seed budget');
  const recent: SeedMessage[] = [];
  let length = pinnedLength;
  const count = Math.max(0, Math.floor(historyLimit));
  for (const message of (count ? history : [])
    .filter((message) => typeof message.content === 'string' && message.content)
    .slice(-count)
    .reverse()) {
    const size = String(message.content).length;
    if (size > 32000 || length + size > 64000) break;
    recent.unshift(message);
    length += size;
  }
  return [...pinned, ...recent];
}

export function liveApplicationFromBuilt(built: SeedMessage[]) {
  const first = built[0];
  if (typeof first?.content !== 'string' || !first.content) return [];
  return [{ role: 'user' as const, text: first.content }];
}
