import { describe, it, expect } from 'vitest';
import { VoiceLedger, type RecordedVoiceTurn } from '@/domains/live/ledger';
import { liveAdmission, readLiveEvent } from '@/domains/live/contract';
import { calculateCapabilities } from '@/domains/access/policy';
describe('provider voice ledger', () => {
  it('waits for playback and late ASR, saves once, and counts provider usage', async () => {
    const ledger = new VoiceLedger();
    const turns: RecordedVoiceTurn[] = [];
    const save = async (turn: RecordedVoiceTurn) => {
      turns.push(turn);
    };
    await ledger.accept({ type: 'input_audio_buffer.committed', item_id: 'u1' }, save);
    await ledger.accept({ type: 'response.created', response: { id: 'r1' } }, save);
    const done = {
      type: 'response.done',
      event_id: 'e1',
      response: {
        id: 'r1',
        status: 'completed',
        output: [{ id: 'a1', content: [{ transcript: 'Hello' }] }],
        usage: { input_tokens: 50, output_tokens: 20 },
      },
    };
    await ledger.accept(done, save);
    await ledger.accept(done, save);
    expect(turns).toEqual([]);
    await ledger.accept({ type: 'output_audio_buffer.stopped', response_id: 'r1' }, save);
    expect(turns).toEqual([]);
    await ledger.accept(
      {
        type: 'conversation.item.input_audio_transcription.completed',
        item_id: 'u1',
        transcript: 'Hi',
      },
      save,
    );
    expect(turns).toEqual([
      {
        user: 'Hi',
        assistant: 'Hello',
        status: 'complete',
        input: 50,
        output: 20,
        providerItemId: 'u1',
        providerResponseId: 'r1',
      },
    ]);
    expect(ledger.inputTokens).toBe(50);
  });
  it('does not save the unheard suffix of a completed but interrupted response', async () => {
    const ledger = new VoiceLedger();
    const turns: RecordedVoiceTurn[] = [];
    const save = async (turn: RecordedVoiceTurn) => {
      turns.push(turn);
    };
    await ledger.accept({ type: 'input_audio_buffer.committed', item_id: 'u1' }, save);
    await ledger.accept(
      {
        type: 'conversation.item.input_audio_transcription.completed',
        item_id: 'u1',
        transcript: 'Explain',
      },
      save,
    );
    await ledger.accept({ type: 'response.created', response: { id: 'r1' } }, save);
    await ledger.accept(
      {
        type: 'response.done',
        response: {
          id: 'r1',
          status: 'completed',
          output: [{ content: [{ transcript: 'Heard words and an unheard suffix' }] }],
        },
      },
      save,
    );
    await ledger.accept({ type: 'output_audio_buffer.cleared', response_id: 'r1' }, save);
    expect(turns[0]?.assistant).toBe('');
    expect(turns[0]?.status).toBe('cancelled');
  });
  it('records failed responses as failed rather than treating response.done as success', async () => {
    const ledger = new VoiceLedger();
    const turns: RecordedVoiceTurn[] = [];
    const save = async (turn: RecordedVoiceTurn) => {
      turns.push(turn);
    };
    await ledger.accept(
      {
        type: 'conversation.item.added',
        item: { id: 'u', role: 'user', content: [{ text: 'Typed question' }] },
      },
      save,
    );
    await ledger.accept({ type: 'response.created', response: { id: 'r' } }, save);
    await ledger.accept({ type: 'response.done', response: { id: 'r', status: 'failed' } }, save);
    expect(turns[0]?.status).toBe('failed');
  });
});
describe('voice admission boundaries', () => {
  it('requires explicit consent and disallows caller-controlled providers, ownership and tools', () => {
    const input = {
      sessionId: crypto.randomUUID(),
      conversationId: crypto.randomUUID(),
      sdp: 'v=0\r\n' + 'a'.repeat(40),
      saveTranscript: true,
      includeContext: false,
    };
    expect(liveAdmission.safeParse(input).success).toBe(true);
    expect(liveAdmission.safeParse({ ...input, saveTranscript: false }).success).toBe(false);
    expect(liveAdmission.safeParse({ ...input, personId: crypto.randomUUID() }).success).toBe(
      false,
    );
    expect(liveAdmission.safeParse({ ...input, tools: ['privileged'] }).success).toBe(false);
    expect(readLiveEvent('{broken')).toBeNull();
  });
  it('does not sell unvalidated voice access through existing paid tiers', () => {
    expect(
      calculateCapabilities({
        tier: 'reserve',
        billing: 'active',
        beta: false,
        accessUntil: '2030-01-01',
      }).has('voice.use'),
    ).toBe(false);
    expect(
      calculateCapabilities({ tier: 'free', billing: 'none', beta: true }).has('voice.use'),
    ).toBe(true);
    expect(
      calculateCapabilities({ tier: 'free', billing: 'none', beta: false, founder: true }).has(
        'voice.use',
      ),
    ).toBe(true);
  });
});

it('preserves spoken then typed turn order when the first ASR completes last', async () => {
  const ledger = new VoiceLedger();
  const turns: RecordedVoiceTurn[] = [];
  const save = async (turn: RecordedVoiceTurn) => {
    turns.push(turn);
  };
  await ledger.accept({ type: 'input_audio_buffer.committed', item_id: 'spoken' }, save);
  await ledger.accept({ type: 'response.created', response: { id: 'first' } }, save);
  await ledger.accept(
    {
      type: 'response.done',
      response: {
        id: 'first',
        status: 'completed',
        output: [{ content: [{ transcript: 'First answer' }] }],
      },
    },
    save,
  );
  await ledger.accept({ type: 'output_audio_buffer.stopped', response_id: 'first' }, save);
  await ledger.accept(
    {
      type: 'conversation.item.added',
      item: { id: 'typed', role: 'user', content: [{ text: 'Second question' }] },
    },
    save,
  );
  await ledger.accept({ type: 'response.created', response: { id: 'second' } }, save);
  await ledger.accept(
    {
      type: 'response.done',
      response: {
        id: 'second',
        status: 'completed',
        output: [{ content: [{ transcript: 'Second answer' }] }],
      },
    },
    save,
  );
  await ledger.accept({ type: 'output_audio_buffer.stopped', response_id: 'second' }, save);
  expect(turns).toEqual([]);
  await ledger.accept(
    {
      type: 'conversation.item.input_audio_transcription.completed',
      item_id: 'spoken',
      transcript: 'First question',
    },
    save,
  );
  expect(turns.map(({ user, assistant }) => [user, assistant])).toEqual([
    ['First question', 'First answer'],
    ['Second question', 'Second answer'],
  ]);
});
it('latches interruption before response.done, waits for usage, and ignores duplicate completion', async () => {
  const ledger = new VoiceLedger();
  const turns: RecordedVoiceTurn[] = [];
  const save = async (turn: RecordedVoiceTurn) => {
    turns.push(turn);
  };
  await ledger.accept(
    {
      type: 'conversation.item.added',
      item: { id: 'user', role: 'user', content: [{ text: 'Question' }] },
    },
    save,
  );
  await ledger.accept({ type: 'response.created', response: { id: 'reply' } }, save);
  await ledger.accept(
    { type: 'response.output_item.added', response_id: 'reply', item: { id: 'answer' } },
    save,
  );
  await ledger.accept({ type: 'conversation.item.truncated', item_id: 'answer' }, save);
  expect(turns).toEqual([]);
  const done = {
    type: 'response.done',
    response: {
      id: 'reply',
      status: 'completed',
      output: [{ content: [{ transcript: 'Unheard suffix' }] }],
      usage: { input_tokens: 7, output_tokens: 3 },
    },
  };
  await ledger.accept(done, save);
  await ledger.accept({ ...done, event_id: 'different-duplicate-event' }, save);
  expect(turns).toEqual([
    {
      user: 'Question',
      assistant: '',
      status: 'cancelled',
      input: 7,
      output: 3,
      providerItemId: 'user',
      providerResponseId: 'reply',
    },
  ]);
  expect(ledger.inputTokens).toBe(7);
});

const compactContextId = 'c' + '0'.repeat(25);
function internalEvent(id: string, type = 'conversation.item.added') {
  return { type, item: { id, role: 'user', content: [{ text: 'Synthetic application context' }] } };
}
async function replyEvents(
  ledger: VoiceLedger,
  save: (turn: RecordedVoiceTurn) => Promise<void>,
  id = 'reply',
  interrupted = false,
) {
  await ledger.accept({ type: 'response.created', response: { id } }, save);
  await ledger.accept(
    {
      type: 'response.done',
      response: {
        id,
        status: 'completed',
        output: [{ id: id + '-output', content: [{ transcript: 'Synthetic answer' }] }],
      },
    },
    save,
  );
  await ledger.accept(
    {
      type: interrupted ? 'output_audio_buffer.cleared' : 'output_audio_buffer.stopped',
      response_id: id,
    },
    save,
  );
}
for (const id of [compactContextId, 'ctx_legacy']) {
  it(`never persists internal context or a context-only notification reply (${id.slice(0, 4)})`, async () => {
    const ledger = new VoiceLedger();
    const saved: RecordedVoiceTurn[] = [];
    const save = async (turn: RecordedVoiceTurn) => {
      saved.push(turn);
    };
    for (const type of [
      'conversation.item.added',
      'conversation.item.created',
      'conversation.item.done',
    ])
      await ledger.accept(internalEvent(id, type), save);
    await replyEvents(ledger, save);
    expect(saved).toEqual([]);
  });
  it(`keeps pending real audio through delayed internal acknowledgements and late ASR (${id.slice(0, 4)})`, async () => {
    const ledger = new VoiceLedger();
    const saved: RecordedVoiceTurn[] = [];
    const save = async (turn: RecordedVoiceTurn) => {
      saved.push(turn);
    };
    await ledger.accept(internalEvent(id), save);
    await ledger.accept({ type: 'input_audio_buffer.committed', item_id: 'item_real' }, save);
    await ledger.accept(internalEvent(id, 'conversation.item.done'), save);
    await ledger.accept(internalEvent(id, 'conversation.item.created'), save);
    await replyEvents(ledger, save);
    expect(saved).toEqual([]);
    await ledger.accept(
      {
        type: 'conversation.item.input_audio_transcription.completed',
        item_id: 'item_real',
        transcript: 'Application context is what I want to discuss',
      },
      save,
    );
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      providerItemId: 'item_real',
      user: 'Application context is what I want to discuss',
      assistant: 'Synthetic answer',
    });
    // A duplicate real item and later system-triggered reply cannot reuse an already paired human input.
    await ledger.accept(
      {
        type: 'conversation.item.added',
        item: {
          id: 'item_real',
          role: 'user',
          content: [{ text: 'Application context is what I want to discuss' }],
        },
      },
      save,
    );
    await ledger.accept(internalEvent(id), save);
    await replyEvents(ledger, save, 'internal-notification');
    expect(saved).toHaveLength(1);
  });
}
it('preserves real typed context-like wording, interruptions, and the next genuine audio turn', async () => {
  const ledger = new VoiceLedger();
  const saved: RecordedVoiceTurn[] = [];
  const save = async (turn: RecordedVoiceTurn) => {
    saved.push(turn);
  };
  await ledger.accept(
    {
      type: 'conversation.item.added',
      item: {
        id: 'conversation-real-typed',
        role: 'user',
        content: [{ text: 'Application context: these are my actual words' }],
      },
    },
    save,
  );
  await ledger.accept(internalEvent(compactContextId), save);
  await replyEvents(ledger, save, 'interrupted-reply', true);
  expect(saved[0]).toMatchObject({
    providerItemId: 'conversation-real-typed',
    status: 'cancelled',
    assistant: '',
  });
  await ledger.accept(internalEvent(compactContextId), save);
  await ledger.accept({ type: 'input_audio_buffer.committed', item_id: 'item_real_next' }, save);
  await ledger.accept(
    {
      type: 'conversation.item.input_audio_transcription.completed',
      item_id: 'item_real_next',
      transcript: 'Actual next speech',
    },
    save,
  );
  await replyEvents(ledger, save, 'next-reply');
  expect(saved).toHaveLength(2);
  expect(saved[1]).toMatchObject({ user: 'Actual next speech', assistant: 'Synthetic answer' });
});

it('does not globally discard genuine audio events even when their provider ID resembles the reserved namespace', async () => {
  const ledger = new VoiceLedger();
  const saved: RecordedVoiceTurn[] = [];
  const save = async (turn: RecordedVoiceTurn) => {
    saved.push(turn);
  };
  await ledger.accept({ type: 'input_audio_buffer.committed', item_id: compactContextId }, save);
  await ledger.accept(
    {
      type: 'conversation.item.input_audio_transcription.completed',
      item_id: compactContextId,
      transcript: 'Actual audio with context-like wording',
    },
    save,
  );
  await replyEvents(ledger, save);
  expect(saved).toHaveLength(1);
  expect(saved[0]?.user).toBe('Actual audio with context-like wording');
});
