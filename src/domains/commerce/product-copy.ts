/** Excerpts of merchant-published plain text, never generated product claims. */
export function productExcerpt(value: string | undefined, limit = 180) {
  const text = (value ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= limit) return text;
  const sentence = text.slice(0, limit).match(/^.*?[.!?](?:\s|$)/)?.[0];
  if (sentence) return sentence.trim();
  const cut = text.slice(0, limit - 1).replace(/\s+\S*$/, '');
  return `${cut || text.slice(0, limit - 1)}…`;
}
