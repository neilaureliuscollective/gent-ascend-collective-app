/** Keep an in-flight code fence from swallowing the rest of a streamed reply. */
export function stabilizeStreamingMarkdown(text: string) {
  const fences = text.match(/```/g)?.length ?? 0;
  return fences % 2 === 1 ? `${text}\n\`\`\`\n` : text;
}
