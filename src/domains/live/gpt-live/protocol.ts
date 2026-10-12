import { z } from 'zod';
const time = z.number().nonnegative().finite();
const transcript = z
  .object({
    type: z.enum(['session.input_transcript.delta', 'session.output_transcript.delta']),
    event_id: z.string().min(1).max(200),
    delta: z.string().max(20000),
    start_ms: time,
    end_ms: time,
  })
  .refine((event) => event.end_ms >= event.start_ms);
const delegation = z.object({
  type: z.literal('session.delegation.created'),
  event_id: z.string().min(1).max(200),
  offset_ms: time,
  delegation: z.object({ id: z.string().min(1).max(200), target: z.literal('client') }),
});
export type LiveFragment = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  startMs: number;
  endMs: number;
};
export type DelegationContext = {
  id: string;
  offsetMs: number;
  fragments: LiveFragment[];
  provisional: true;
};
/** GPT-Live does not emit Realtime's turn/playback completion events. Never fabricate those. */
export class OpenAILiveProtocol {
  fragments: LiveFragment[] = [];
  seconds = 0;
  started = false;
  finalized = false;
  private seen = new Set<string>();
  private delegated = new Set<string>();
  constructor(private readonly expectedSessionId?: string) {}
  accept(raw: unknown): DelegationContext | null {
    if (!raw || typeof raw !== 'object') return null;
    const event = raw as {
      type?: unknown;
      event_id?: unknown;
      usage?: { seconds?: unknown };
      session?: { id?: unknown };
    };
    if (typeof event.event_id !== 'string' || !event.event_id || event.event_id.length > 200)
      return null;
    if (this.seen.has(event.event_id)) return null;
    if (this.seen.size >= 4096) throw new Error('Live event budget exceeded');
    this.seen.add(event.event_id);
    if (event.type === 'session.started') {
      if (this.expectedSessionId && event.session?.id !== this.expectedSessionId) return null;
      this.started = true;
      return null;
    }
    if (event.type === 'session.usage.updated' || event.type === 'session.closed') {
      const seconds = time.safeParse(event.usage?.seconds);
      if (seconds.success) this.seconds = Math.max(this.seconds, seconds.data);
      if (
        event.type === 'session.closed' &&
        seconds.success &&
        typeof event.session?.id === 'string' &&
        (!this.expectedSessionId || event.session.id === this.expectedSessionId)
      )
        this.finalized = true;
      return null;
    }
    const part = transcript.safeParse(raw);
    if (part.success) {
      this.fragments.push({
        id: part.data.event_id,
        role: part.data.type === 'session.input_transcript.delta' ? 'user' : 'assistant',
        text: part.data.delta,
        startMs: part.data.start_ms,
        endMs: part.data.end_ms,
      });
      this.fragments = this.fragments.slice(-256);
      return null;
    }
    const request = delegation.safeParse(raw);
    if (!request.success || this.delegated.has(request.data.delegation.id)) return null;
    this.delegated.add(request.data.delegation.id);
    return {
      id: request.data.delegation.id,
      offsetMs: request.data.offset_ms,
      fragments: this.fragments.filter((part) => part.endMs <= request.data.offset_ms).slice(-40),
      provisional: true,
    };
  }
  closeCommand() {
    return { type: 'session.close', event_id: crypto.randomUUID() };
  }
  update(id: string | null, content: string, speak = false) {
    if (!this.started || this.finalized) throw new Error('Live session is not ready');
    if (new TextEncoder().encode(content).length > 1200)
      throw new Error('Live context update exceeds conservative token budget');
    return {
      type: speak ? 'session.commentary.append' : 'session.thinking.append',
      event_id: crypto.randomUUID(),
      delegation_id: id,
      content,
    };
  }
}
export function liveStartup(input: {
  voice: 'cedar' | 'marin';
  history: { role: 'user' | 'assistant'; text: string }[];
}) {
  let budget = 5000;
  const history = input.history
    .slice(-20)
    .reverse()
    .flatMap((message) => {
      const bytes = new TextEncoder().encode(message.text).length;
      if (!message.text || bytes > budget) return [];
      budget -= bytes;
      return [
        {
          type: 'message',
          role: message.role,
          content: [
            {
              type: message.role === 'assistant' ? 'output_text' : 'input_text',
              text: message.text,
            },
          ],
        },
      ];
    })
    .reverse();
  return {
    model: 'gpt-live-1',
    store: false,
    delegation: { type: 'client' },
    audio: { output: { voice: input.voice } },
    instructions:
      'You are Aethelios, the personal intelligence of Aethelios — The Human Ascendance. Speak naturally, calmly and briefly. Preserve human agency. Listen through interruptions and corrections. Delegate requested research, image creation/revision and specialist tasks to the application backend; do not claim to execute or complete them yourself. The application enforces ownership, consent, approvals and quotas. Continue normal conversation while work is pending. Distinguish verified saved results from provisional transcripts, assumptions and generated concepts. Do not claim private memories, tools or records that the backend has not supplied.',
    input: history,
    client: {
      data_channel: {
        allowed_client_events: [
          'session.input_audio.mute',
          'session.input_audio.unmute',
          'session.close',
        ],
        allowed_server_events: [
          'session.started',
          'session.input_transcript.delta',
          'session.output_transcript.delta',
          'session.usage.updated',
          'session.closed',
          'error',
        ],
      },
    },
  };
}
