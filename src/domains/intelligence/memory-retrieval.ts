/** Person-bound confirmed memories only. Inferences are never selected. */
export const MEMORY_STORE_LIMIT = 24;
export const MEMORY_CONTEXT_LIMIT = 6;

export type RetrievableMemory = {
  content: string;
  confirmed_at: string;
};

export function tokenizeQuestion(text: string) {
  return [...new Set(text.toLowerCase().match(/[a-z0-9]{4,}/g) ?? [])];
}

export function scoreMemory(content: string, tokens: readonly string[]) {
  const hay = content.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (hay.includes(token)) score += 1;
  }
  const compact = hay.replace(/[^a-z0-9]+/g, ' ').trim();
  if (compact.length >= 12 && tokens.join(' ').includes(compact.slice(0, 12))) score += 2;
  return score;
}

export function selectConfirmedMemories<T extends RetrievableMemory>(
  memories: readonly T[],
  question?: string,
  limit = MEMORY_CONTEXT_LIMIT,
): T[] {
  const bounded = memories.slice(0, MEMORY_STORE_LIMIT);
  if (!question) return [...bounded];
  const tokens = tokenizeQuestion(question);
  if (!tokens.length) return [];
  return bounded
    .map((row, index) => ({
      row,
      score: scoreMemory(row.content, tokens),
      recency: Date.parse(row.confirmed_at) || 0,
      index,
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.recency - a.recency || a.index - b.index)
    .slice(0, limit)
    .map((item) => item.row);
}
