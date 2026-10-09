import type { StreamEvent } from './types';
// Incremental NDJSON; completion is acknowledged only by a saved event.
export async function consumeReply(response: Response, receive: (event: StreamEvent) => void) {
  const reader = response.body?.getReader();
  if (!reader) throw Error('Reply unavailable.');
  const decoder = new TextDecoder();
  let pending = '',
    size = 0,
    saved = false;
  const line = (raw: string) => {
    if (!raw.trim()) return;
    const event = JSON.parse(raw) as StreamEvent;
    if (event.type === 'saved') saved = true;
    receive(event);
  };
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > 300000) throw Error('Reply exceeded its limit.');
      pending += decoder.decode(chunk.value, { stream: true });
      let end;
      while ((end = pending.indexOf('\n')) >= 0) {
        line(pending.slice(0, end));
        pending = pending.slice(end + 1);
      }
    }
    line(pending + decoder.decode());
    if (!saved) throw Error('Reply was not confirmed saved. Reload before retrying.');
  } finally {
    await reader.cancel();
  }
}
