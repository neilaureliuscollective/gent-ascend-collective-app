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
      { user: 'Hi', assistant: 'Hello', status: 'complete', input: 50, output: 20 },
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
    { user: 'Question', assistant: '', status: 'cancelled', input: 7, output: 3 },
  ]);
  expect(ledger.inputTokens).toBe(7);
});
