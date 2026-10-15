import { readLiveEvent } from './contract';
import type { SeedMessage } from './context-budget';
export type SeedEntry = {
  id: string;
  eventId: string;
  message: SeedMessage;
};
const codes = new Set([
  'invalid_request_error',
  'invalid_value',
  'invalid_type',
  'missing_required_parameter',
  'unknown_parameter',
  'invalid_event',
  'server_error',
  'rate_limit_exceeded',
  'conversation_already_has_active_response',
  'item_not_found',
]);
const types = new Set(['invalid_request_error', 'server_error']);
function field(value: unknown, allowed: Set<string>) {
  return typeof value === 'string' && allowed.has(value) ? value : null;
}
function param(value: unknown) {
  return typeof value === 'string' &&
    value.length <= 100 &&
    /^(?:item(?:\.(?:id|type|role|content)(?:\[\d{1,3}\])?(?:\.(?:type|text))?)?|previous_item_id|event_id|type)$/.test(
      value,
    )
    ? value
    : null;
}
export class LiveSeedError extends Error {
  constructor(
    public category: 'rejected' | 'unavailable' | 'timeout',
    public detail: Record<string, string | number | null>,
  ) {
    super('Live context admission failed');
  }
}
/** Keep seed text inside transport only. Receipts contain allowlisted protocol fields and sizes. */
export function admitLiveSeed(socket: WebSocket, seed: SeedEntry[], timeoutMs = 10000) {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const pending = new Set(seed.map((entry) => entry.id));
    const sentEvents = new Map(seed.map((entry, index) => [entry.eventId, { entry, index }]));
    const cleanup = () => {
      settled = true;
      clearTimeout(timeout);
      socket.removeEventListener('message', message);
      socket.removeEventListener('close', closed);
      socket.removeEventListener('error', closed);
    };
    const fail = (category: LiveSeedError['category'], extra = {}) => {
      if (settled) return;
      cleanup();
      reject(
        new LiveSeedError(category, {
          seedCount: seed.length,
          pendingCount: pending.size,
          ...extra,
        }),
      );
    };
    const closed = () => fail('unavailable');
    const message = (event: MessageEvent) => {
      const value = readLiveEvent(event.data);
      if (value?.type === 'error') {
        const match =
          typeof value.error?.event_id === 'string'
            ? sentEvents.get(value.error.event_id)
            : undefined;
        fail('rejected', {
          providerCode: field(value.error?.code, codes),
          providerType: field(value.error?.type, types),
          providerParam: param(value.error?.param),
          seedEventId: match?.entry.eventId ?? null,
          seedIndex: match?.index ?? null,
          seedRole: field(match?.entry.message.role, new Set(['user', 'assistant', 'system'])),
          seedLength: match ? String(match.entry.message.content).length : null,
        });
        return;
      }
      if (
        value?.item?.id &&
        ['conversation.item.created', 'conversation.item.added'].includes(value.type) &&
        pending.delete(value.item.id) &&
        !pending.size
      ) {
        cleanup();
        resolve();
      }
    };
    const timeout = setTimeout(() => fail('timeout'), timeoutMs);
    socket.addEventListener('message', message);
    socket.addEventListener('close', closed);
    socket.addEventListener('error', closed);
    if (!pending.size) {
      cleanup();
      resolve();
      return;
    }
    try {
      for (const entry of seed) {
        if (settled) break;
        socket.send(
          JSON.stringify({
            event_id: entry.eventId,
            type: 'conversation.item.create',
            item: {
              id: entry.id,
              type: 'message',
              role: entry.message.role,
              content: [
                {
                  type: entry.message.role === 'assistant' ? 'output_text' : 'input_text',
                  text: entry.message.content,
                },
              ],
            },
          }),
        );
      }
    } catch {
      fail('unavailable');
    }
  });
}
