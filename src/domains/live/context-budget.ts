export type SeedMessage = { role: string; content: unknown };

export function budgetLiveSeed(
  application: SeedMessage[],
  history: SeedMessage[],
  historyLimit: number,
) {
  const pinned = application.filter(
    (message) => typeof message.content === 'string' && message.content,
  );
  const recent = history
    .filter((message) => typeof message.content === 'string' && message.content)
    .slice(-historyLimit);
  return [...pinned, ...recent];
}
