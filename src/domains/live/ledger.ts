import type { LiveEvent } from './contract';
export type RecordedVoiceTurn = {
  user: string;
  assistant: string;
  status: 'complete' | 'cancelled' | 'failed';
  input: number;
  output: number;
};
type Reply = {
  item: string;
  text: string;
  status?: RecordedVoiceTurn['status'];
  input: number;
  output: number;
  played: boolean;
  outputItems: string[];
};
/** Provider-only ledger. ASR can arrive after response.done; playback can finish later still. */
export class VoiceLedger {
  private users = new Map<string, string>();
  private replies = new Map<string, Reply>();
  private latest = '';
  private active = '';
  private seen = new Set<string>();
  inputTokens = 0;
  outputTokens = 0;
  async accept(event: LiveEvent, save: (turn: RecordedVoiceTurn) => Promise<void>) {
    if (event.event_id) {
      if (this.seen.has(event.event_id)) return;
      this.seen.add(event.event_id);
      if (this.seen.size > 2048) throw new Error('Voice event limit');
    }
    if (event.type === 'input_audio_buffer.committed' && event.item_id) this.latest = event.item_id;
    if (
      ['conversation.item.created', 'conversation.item.added', 'conversation.item.done'].includes(
        event.type,
      ) &&
      event.item?.role === 'user' &&
      event.item.id
    ) {
      if (event.item.id.startsWith('ctx_')) {
        this.latest = '';
        return;
      }
      if (event.type !== 'conversation.item.done') this.latest = event.item.id;
      const text = event.item.content
        ?.map((part) => part.text ?? '')
        .join('')
        .slice(0, 8000);
      if (text) this.users.set(event.item.id, text);
    }
    if (
      event.type === 'conversation.item.input_audio_transcription.completed' &&
      event.item_id &&
      typeof event.transcript === 'string'
    )
      this.users.set(event.item_id, event.transcript.slice(0, 8000));
    if (event.type === 'response.created' && event.response?.id && this.latest) {
      this.active = event.response.id;
      this.replies.set(this.active, {
        item: this.latest,
        text: '',
        input: 0,
        output: 0,
        played: false,
        outputItems: [],
      });
    }
    if (event.type === 'response.output_item.added' && event.response_id && event.item?.id) {
      this.replies.get(event.response_id)?.outputItems.push(event.item.id);
    }
    if (event.type === 'response.done' && event.response?.id) {
      const response = event.response;
      const reply = this.replies.get(response.id!);
      const input = safeTokens(response.usage?.input_tokens),
        output = safeTokens(response.usage?.output_tokens);
      this.inputTokens += input;
      this.outputTokens += output;
      if (reply) {
        reply.outputItems =
          response.output?.map((item) => item.id).filter((id): id is string => !!id) ??
          reply.outputItems;
        reply.input = input;
        reply.output = output;
        reply.text =
          response.output
            ?.flatMap((item) => item.content ?? [])
            .map((part) => part.transcript ?? part.text ?? '')
            .join('')
            .slice(0, 20000) ?? '';
        reply.status =
          response.status === 'completed'
            ? 'complete'
            : response.status === 'cancelled'
              ? 'cancelled'
              : 'failed';
        if (reply.status !== 'complete') {
          reply.text = '';
          reply.played = true;
        }
      }
    }
    if (['output_audio_buffer.stopped', 'output_audio_buffer.cleared'].includes(event.type)) {
      const reply = this.replies.get(event.response_id ?? this.active);
      if (reply) {
        reply.played = true;
        if (event.type.endsWith('cleared')) {
          reply.status = 'cancelled';
          reply.text = '';
        }
      }
    }
    // An interruption must never persist an unheard suffix as a completed answer.
    if (event.type === 'conversation.item.truncated') {
      const reply = [...this.replies.values()].find(
        (reply) => event.item_id && reply.outputItems.includes(event.item_id),
      );
      if (reply) {
        reply.status = 'cancelled';
        reply.text = '';
        reply.played = true;
      }
    }
    for (const [id, reply] of this.replies) {
      const user = this.users.get(reply.item);
      if (reply.status && reply.played && user) {
        await save({
          user,
          assistant: reply.text,
          status: reply.status,
          input: reply.input,
          output: reply.output,
        });
        this.replies.delete(id);
        this.users.delete(reply.item);
      }
    }
  }
}
function safeTokens(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}
