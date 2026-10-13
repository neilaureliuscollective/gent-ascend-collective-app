import type { StreamEvent } from '@/domains/intelligence/types';
/** Shared NDJSON transport: bounded frames, split UTF-8, and a final unterminated event. */
export async function* readConversationStream(body: ReadableStream<Uint8Array> | null) {
  if (!body) throw new Error('No reply stream was received.');
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let newline: number;
      while ((newline = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (line.length > 262144) throw new Error('Reply event exceeded the transport limit.');
        if (line.trim()) yield JSON.parse(line) as StreamEvent;
      }
      if (buffer.length > 262144) throw new Error('Reply event exceeded the transport limit.');
      if (done) {
        if (buffer.trim()) yield JSON.parse(buffer) as StreamEvent;
        return;
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
