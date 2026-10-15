import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveController } from '@/domains/live/controller';
let stop: ReturnType<typeof vi.fn>, fetchMock: ReturnType<typeof vi.fn>;
class FakePC {
  static instances: FakePC[] = [];
  connectionState = 'new';
  localDescription = { sdp: 'v=0\r\na=synthetic-offer' };
  channel = {
    readyState: 'open',
    send: vi.fn(),
    close: vi.fn(),
    onmessage: null as null | ((event: { data: string }) => void),
    onopen: null as null | (() => void),
    onclose: null as null | (() => void),
  };
  ontrack = null;
  onconnectionstatechange: (() => void) | null = null;
  constructor() {
    FakePC.instances.push(this);
  }
  addTrack() {}
  async createOffer() {
    return { type: 'offer', sdp: this.localDescription.sdp };
  }
  async setLocalDescription() {}
  async setRemoteDescription() {
    this.channel.onopen?.();
  }
  createDataChannel() {
    return this.channel;
  }
  close = vi.fn();
  async getStats() {
    return new Map();
  }
  event(value: unknown) {
    this.channel.onmessage?.({ data: JSON.stringify(value) });
  }
}
beforeEach(() => {
  FakePC.instances = [];
  stop = vi.fn();
  const tracks = [{ enabled: true, stop, addEventListener: vi.fn() }];
  vi.stubGlobal('window', { isSecureContext: true });
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: vi
        .fn()
        .mockResolvedValue({ getTracks: () => tracks, getAudioTracks: () => tracks }),
    },
  });
  vi.stubGlobal('document', {
    createElement: () => ({
      autoplay: false,
      volume: 1,
      setAttribute: vi.fn(),
      pause: vi.fn(),
      remove: vi.fn(),
      srcObject: null,
      play: vi.fn().mockResolvedValue(undefined),
    }),
  });
  vi.stubGlobal('RTCPeerConnection', FakePC);
  fetchMock = vi.fn().mockImplementation(async (_url, init) =>
    Response.json(
      init.method === 'DELETE'
        ? { ended: true }
        : {
            answer: 'v=0\r\na=synthetic-answer',
            expiresAt: new Date(Date.now() + 120000).toISOString(),
          },
    ),
  );
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());
const conversation = 'ed000000-0000-4000-8000-000000000001';
it('starts voice inline instead of forcing a new immersive conversation', async () => {
  const controller = new LiveController();
  expect(controller.getSnapshot().mode).toBe('compact');
  await controller.start(conversation, false);
  expect(controller.getSnapshot().mode).toBe('compact');
  expect(controller.getSnapshot().conversationId).toBe(conversation);
  controller.mode('immersive');
  expect(controller.getSnapshot().mode).toBe('immersive');
  expect(fetchMock.mock.calls.filter((call) => call[1].method === 'POST')).toHaveLength(1);
  await controller.end();
});
it('keeps a failed admission in the same conversation and does not reconnect on expand', async () => {
  fetchMock.mockResolvedValueOnce(
    Response.json(
      {
        error: 'The voice provider did not complete admission. Your text workspace remains available.',
        detail: { stage: 'provider' },
      },
      { status: 503 },
    ),
  );
  const controller = new LiveController();
  await controller.start(conversation, false);
  expect(controller.getSnapshot()).toMatchObject({
    phase: 'error',
    mode: 'compact',
    conversationId: conversation,
    error: expect.stringMatching(/provider did not complete admission/),
  });
  controller.mode('immersive');
  expect(fetchMock.mock.calls.filter((call) => call[1].method === 'POST')).toHaveLength(1);
  controller.dismiss();
  expect(controller.getSnapshot().phase).toBe('idle');
});
it('does not send typed Talk text until the voice channel is open', async () => {
  const controller = new LiveController();
  await controller.start(conversation, false);
  FakePC.instances.at(-1)!.channel.readyState = 'connecting';
  expect(controller.text('Typed while connecting')).toEqual({
    accepted: false,
    reason: 'channel',
  });
  expect(FakePC.instances.at(-1)!.channel.send).not.toHaveBeenCalled();
  await controller.end();
});
it('rejects over-limit typed voice text and keeps it unsent', async () => {
  const controller = new LiveController();
  await controller.start(conversation, false);
  const sent = controller.text('x'.repeat(4001));
  expect(sent).toEqual({ accepted: false, reason: 'limit' });
  expect(FakePC.instances.at(-1)!.channel.send).not.toHaveBeenCalled();
  await controller.end();
});
it('scopes late transcript invalidation after End without starting another admission', async () => {
  const controller = new LiveController();
  await controller.start(conversation, false);
  FakePC.instances.at(-1)!.event({
    type: 'conversation.item.input_audio_transcription.completed',
    item_id: 'user-1',
    transcript: 'Yes',
  });
  await controller.end();
  expect(controller.getSnapshot().persistence).toBe('pending');
  expect(controller.getSnapshot().transcript.some((line) => line.text === 'Yes')).toBe(true);
  controller.invalidateTranscript();
  expect(controller.getSnapshot().transcript).toEqual([]);
});
it('exports content-free diagnostics with trusted configuration and preserves them after End', async () => {
  fetchMock.mockImplementation(async (_url, init) =>
    Response.json(
      init.method === 'DELETE'
        ? { ended: true }
        : {
            answer: 'v=0\r\na=synthetic-answer',
            expiresAt: new Date(Date.now() + 120000).toISOString(),
            model: 'gpt-realtime',
          },
    ),
  );
  const controller = new LiveController();
  await controller.start(conversation, false, 'marin');
  FakePC.instances.at(-1)!.event({
    type: 'conversation.item.input_audio_transcription.completed',
    item_id: 'private-id',
    transcript: 'PRIVATE TRANSCRIPT',
  });
  const first = await controller.exportDiagnostics();
  expect(first.voice).toBe('marin');
  expect(first.model).toBe('gpt-realtime');
  expect(first.metrics.connection_event_ms?.count).toBe(1);
  expect(JSON.stringify(first)).not.toMatch(/private-id|PRIVATE TRANSCRIPT|ed000000/);
  await controller.end();
  const ended = await controller.exportDiagnostics();
  expect(ended.metrics.connection_event_ms?.count).toBe(1);
  expect(ended.durationMs).toBe((await controller.exportDiagnostics()).durationMs);
});
describe('shared voice transport lifecycle', () => {
  it('keeps one transport across presentation modes and releases tracks on end', async () => {
    const controller = new LiveController();
    await controller.start(conversation, false);
    controller.mode('compact');
    controller.mode('immersive');
    expect(fetchMock.mock.calls.filter((call) => call[1].method === 'POST')).toHaveLength(1);
    expect(controller.getSnapshot().phase).toBe('listening');
    await controller.end();
    expect(stop).toHaveBeenCalledOnce();
    expect(FakePC.instances.at(-1)!.close).toHaveBeenCalledOnce();
  });
  it('clears buffered playback without cancelling a response whose generation has finished', async () => {
    const controller = new LiveController();
    await controller.start(conversation, false);
    FakePC.instances.at(-1)!.event({ type: 'response.created', response: { id: 'r' } });
    FakePC.instances
      .at(-1)!
      .event({ type: 'response.done', response: { id: 'r', status: 'completed' } });
    FakePC.instances.at(-1)!.event({ type: 'output_audio_buffer.started', response_id: 'r' });
    controller.interrupt();
    const events = FakePC.instances
      .at(-1)!
      .channel.send.mock.calls.map((call) => JSON.parse(call[0]));
    expect(events).toEqual([{ type: 'output_audio_buffer.clear' }]);
    await controller.end();
  });
  it('does not let an old response completion change the current generation state', async () => {
    const controller = new LiveController();
    await controller.start(conversation, false);
    FakePC.instances.at(-1)!.event({ type: 'response.created', response: { id: 'old' } });
    FakePC.instances.at(-1)!.event({ type: 'response.created', response: { id: 'current' } });
    FakePC.instances
      .at(-1)!
      .event({ type: 'response.done', response: { id: 'old', status: 'cancelled' } });
    controller.interrupt();
    expect(
      FakePC.instances.at(-1)!.channel.send.mock.calls.map((call) => JSON.parse(call[0])),
    ).toEqual([
      expect.objectContaining({
        type: 'response.cancel',
        response_id: 'current',
        event_id: expect.any(String),
      }),
    ]);
    await controller.end();
  });
  it('fences a late SDP answer after cancellation and revokes the late admission', async () => {
    let resolve!: (value: Response) => void;
    fetchMock.mockImplementation(async (_url, init) =>
      init.method === 'POST'
        ? new Promise<Response>((r) => {
            resolve = r;
          })
        : Response.json({ ended: true }),
    );
    const controller = new LiveController();
    const starting = controller.start(conversation, false);
    await vi.waitFor(() => expect(resolve).toBeTypeOf('function'));
    await controller.end();
    resolve(
      Response.json({
        answer: 'v=0\r\na=late',
        expiresAt: new Date(Date.now() + 120000).toISOString(),
      }),
    );
    await starting;
    expect(controller.getSnapshot().phase).toBe('ended');
    expect(stop).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls.filter((call) => call[1].method === 'DELETE')).toHaveLength(2);
  });
  it('blocks another admission while server cleanup is uncertain', async () => {
    const controller = new LiveController();
    await controller.start(conversation, false);
    fetchMock.mockImplementation(async () =>
      Response.json({ error: 'Unavailable' }, { status: 503 }),
    );
    await controller.end();
    await controller.start(conversation, false);
    expect(controller.getSnapshot().cleanupPending).toBe(true);
    expect(fetchMock.mock.calls.filter((call) => call[1].method === 'POST')).toHaveLength(1);
  });
});

it('preserves owned visual selection through minimize/end and clears it for a different conversation', async () => {
  const controller = new LiveController();
  controller.bindConversation(conversation);
  const workspace = {
    artifacts: [],
    selectedId: 'owned-visual',
    selectedPartId: 'tools',
    scenarioPercent: 10,
    projects: [],
  };
  fetchMock.mockResolvedValue(Response.json(workspace));
  await controller.refreshArtifacts();
  controller.mode('compact');
  expect(controller.getSnapshot().artifactWorkspace).toEqual(workspace);
  await controller.end();
  expect(controller.getSnapshot().artifactWorkspace).toEqual(workspace);
  controller.mode('immersive');
  expect(controller.getSnapshot().artifactWorkspace.selectedPartId).toBe('tools');
  controller.bindConversation('00000000-0000-4000-8000-000000000098');
  expect(controller.getSnapshot().artifactWorkspace.selectedId).toBeNull();
});

it('does not relabel voice session identity or transcript when artifacts open another conversation', async () => {
  const controller = new LiveController();
  await controller.start(conversation, false);
  FakePC.instances.at(-1)!.event({
    type: 'conversation.item.input_audio_transcription.completed',
    item_id: 'user-1',
    transcript: 'Same words twice',
  });
  await controller.end();
  const ended = controller.getSnapshot();
  expect(ended.conversationId).toBe(conversation);
  expect(ended.transcript[0]?.text).toBe('Same words twice');
  controller.bindConversation('00000000-0000-4000-8000-000000000098');
  expect(controller.getSnapshot().conversationId).toBe(conversation);
  expect(controller.getSnapshot().sessionId).toBe(ended.sessionId);
  expect(controller.getSnapshot().transcript).toEqual(ended.transcript);
  controller.acknowledgePersistence('00000000-0000-4000-8000-000000000077');
  expect(controller.getSnapshot().persistence).toBe('pending');
  controller.acknowledgePersistence(ended.sessionId);
  expect(controller.getSnapshot().persistence).toBe('acknowledged');
});

it('ignores a delayed receipt after a replacement session in the same conversation', async () => {
  const controller = new LiveController();
  await controller.start(conversation, false);
  FakePC.instances.at(-1)!.event({
    type: 'conversation.item.input_audio_transcription.completed',
    item_id: 'user-old',
    transcript: 'First session',
  });
  await controller.end();
  const first = controller.getSnapshot();
  expect(first.persistence).toBe('pending');
  const delayed = { sessionId: first.sessionId!, epoch: first.persistenceEpoch };
  await controller.start(conversation, false);
  const second = controller.getSnapshot();
  expect(second.sessionId).not.toBe(first.sessionId);
  expect(second.persistenceEpoch).toBeGreaterThan(first.persistenceEpoch);
  expect(second.transcript).toEqual([]);
  controller.markSavedItems(['user-old'], delayed);
  controller.markPersistence('uncertain', delayed);
  controller.acknowledgePersistence(delayed.sessionId, delayed.epoch);
  const afterLate = controller.getSnapshot();
  expect(afterLate.sessionId).toBe(second.sessionId);
  expect(afterLate.savedItemIds).toEqual([]);
  expect(afterLate.persistence).toBe('idle');
  expect(afterLate.transcript).toEqual([]);
  controller.markPersistence('pending', {
    sessionId: second.sessionId!,
    epoch: second.persistenceEpoch,
  });
  expect(controller.getSnapshot().persistence).toBe('pending');
  await controller.end();
});

it('shows speech detection and processing from real provider events', async () => {
  const controller = new LiveController();
  await controller.start(conversation, false);
  const pc = FakePC.instances.at(-1)!;
  pc.event({ type: 'input_audio_buffer.speech_started' });
  expect(controller.getSnapshot().speechDetected).toBe(true);
  pc.event({ type: 'input_audio_buffer.speech_stopped' });
  expect(controller.getSnapshot().responsePending).toBe(true);
  expect(controller.getSnapshot().speechDetected).toBe(false);
  pc.event({ type: 'response.created', response: { id: 'current' } });
  controller.interrupt();
  expect(controller.getSnapshot().responsePending).toBe(false);
  expect(controller.getSnapshot().phase).toBe('listening');
  await controller.end();
});
it('retains one admission during transient ICE recovery and cleans up a sustained disconnect', async () => {
  vi.useFakeTimers();
  try {
    const controller = new LiveController();
    await controller.start(conversation, false);
    const pc = FakePC.instances.at(-1)!;
    pc.connectionState = 'disconnected';
    (pc.onconnectionstatechange as unknown as () => void)();
    expect(controller.getSnapshot().recovering).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    pc.connectionState = 'connected';
    (pc.onconnectionstatechange as unknown as () => void)();
    expect(controller.getSnapshot().recovering).toBe(false);
    await vi.advanceTimersByTimeAsync(5000);
    expect(controller.getSnapshot().phase).toBe('listening');
    expect(fetchMock.mock.calls.filter((call) => call[1].method === 'POST')).toHaveLength(1);
    pc.connectionState = 'disconnected';
    (pc.onconnectionstatechange as unknown as () => void)();
    await vi.advanceTimersByTimeAsync(5000);
    expect(controller.getSnapshot().phase).toBe('ended');
    expect(stop).toHaveBeenCalledOnce();
    expect(controller.getSnapshot().cleanupPending).toBe(false);
  } finally {
    vi.useRealTimers();
  }
});
it('allows a permission-denied session to retry only after cleanup', async () => {
  const mic = vi.mocked(navigator.mediaDevices.getUserMedia);
  mic.mockRejectedValueOnce(new Error('Permission denied'));
  const controller = new LiveController();
  await controller.start(conversation, false);
  expect(controller.getSnapshot().phase).toBe('error');
  expect(controller.getSnapshot().cleanupPending).toBe(false);
  await controller.start(conversation, false);
  expect(controller.getSnapshot().phase).toBe('listening');
  await controller.end();
});

it('ignores stale playback-stop events from an interrupted response', async () => {
  const controller = new LiveController();
  await controller.start(conversation, false);
  const pc = FakePC.instances.at(-1)!;
  pc.event({ type: 'response.created', response: { id: 'old' } });
  pc.event({ type: 'output_audio_buffer.started', response_id: 'old' });
  controller.interrupt();
  pc.event({ type: 'response.created', response: { id: 'new' } });
  pc.event({ type: 'output_audio_buffer.started', response_id: 'new' });
  pc.event({ type: 'output_audio_buffer.cleared', response_id: 'old' });
  expect(controller.getSnapshot().phase).toBe('speaking');
  await controller.end();
});

it('VAD interruption does not send a redundant cancel or tear down on its recoverable error', async () => {
  const controller = new LiveController();
  await controller.start(conversation, false);
  const pc = FakePC.instances.at(-1)!;
  pc.event({ type: 'response.created', response: { id: 'r-vad' } });
  pc.event({ type: 'output_audio_buffer.started', response_id: 'r-vad' });
  pc.event({ type: 'input_audio_buffer.speech_started' });
  expect(pc.channel.send).not.toHaveBeenCalled();
  pc.event({ type: 'response.done', response: { id: 'r-vad', status: 'cancelled' } });
  pc.event({
    type: 'error',
    error: { code: 'response_cancel_not_active', type: 'invalid_request_error' },
  });
  expect(controller.getSnapshot().phase).toBe('listening');
  expect(stop).not.toHaveBeenCalled();
  pc.event({ type: 'response.created', response: { id: 'next' } });
  pc.event({ type: 'output_audio_buffer.started', response_id: 'next' });
  expect(controller.getSnapshot().phase).toBe('speaking');
  await controller.end();
  expect(stop).toHaveBeenCalled();
});
it('a correlated explicit cancel race releases one queued typed response without a duplicate', async () => {
  const controller = new LiveController();
  await controller.start(conversation, false);
  const pc = FakePC.instances.at(-1)!;
  pc.event({ type: 'response.created', response: { id: 'old' } });
  controller.text('New typed thought');
  const cancel = pc.channel.send.mock.calls
    .map((c) => JSON.parse(c[0]))
    .find((e) => e.type === 'response.cancel');
  pc.event({
    type: 'error',
    error: { code: 'response_cancel_not_active', event_id: cancel.event_id },
  });
  pc.event({ type: 'response.done', response: { id: 'old', status: 'cancelled' } });
  expect(
    pc.channel.send.mock.calls
      .map((c) => JSON.parse(c[0]))
      .filter((e) => e.type === 'response.create'),
  ).toHaveLength(1);
  expect(controller.getSnapshot().phase).toBe('listening');
  await controller.end();
});
it('unknown provider errors still close media and require server cleanup', async () => {
  const controller = new LiveController();
  await controller.start(conversation, false);
  FakePC.instances.at(-1)!.event({ type: 'error', error: { code: 'unknown' } });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(controller.getSnapshot().phase).toBe('ended');
  expect(stop).toHaveBeenCalled();
  expect(fetchMock.mock.calls.some((call) => call[1].method === 'DELETE')).toBe(true);
});

it('keeps delayed speech transcription before its answer and the following typed turn', async () => {
  const controller = new LiveController();
  await controller.start(conversation, false);
  const pc = FakePC.instances.at(-1)!;
  pc.event({ type: 'input_audio_buffer.committed', item_id: 'voice' });
  pc.event({
    type: 'response.output_audio_transcript.delta',
    item_id: 'answer',
    delta: 'First answer',
  });
  pc.event({
    type: 'conversation.item.added',
    item: { id: 'typed', role: 'user', content: [{ text: 'Follow up' }] },
  });
  pc.event({
    type: 'conversation.item.input_audio_transcription.completed',
    item_id: 'voice',
    transcript: 'First question',
  });
  pc.event({
    type: 'conversation.item.added',
    item: { id: 'ctx_private', role: 'user', content: [{ text: 'Private context seed' }] },
  });
  expect(controller.getSnapshot().transcript.map((line) => line.text)).toEqual([
    'First question',
    'First answer',
    'Follow up',
  ]);
  await controller.end();
});
it('keeps cleanup pending on a successful HTTP response without an End receipt', async () => {
  const controller = new LiveController();
  await controller.start(conversation, false);
  fetchMock.mockResolvedValue(Response.json({ ended: false }));
  await controller.end();
  await controller.start(conversation, false);
  expect(controller.getSnapshot().cleanupPending).toBe(true);
  expect(fetchMock.mock.calls.filter((call) => call[1].method === 'POST')).toHaveLength(1);
  fetchMock.mockResolvedValue(Response.json({ ended: true }));
  await controller.end();
  expect(controller.getSnapshot().cleanupPending).toBe(false);
});
it('coalesces overlapping End attempts so stale failures cannot replace confirmed cleanup', async () => {
  const controller = new LiveController();
  await controller.start(conversation, false);
  let resolve!: (r: Response) => void;
  fetchMock.mockImplementation(
    () =>
      new Promise<Response>((r) => {
        resolve = r;
      }),
  );
  const first = controller.end();
  const second = controller.end();
  expect(fetchMock.mock.calls.filter((call) => call[1].method === 'DELETE')).toHaveLength(1);
  resolve(Response.json({ ended: true }));
  await Promise.all([first, second]);
  expect(controller.getSnapshot().cleanupPending).toBe(false);
});
it('does not schedule a stale expiry when End occurs during remote description setup', async () => {
  vi.useFakeTimers();
  let resolve!: () => void;
  const remote = vi.spyOn(FakePC.prototype, 'setRemoteDescription').mockImplementation(
    () =>
      new Promise<void>((r) => {
        resolve = r;
      }),
  );
  try {
    const controller = new LiveController();
    const starting = controller.start(conversation, false);
    await vi.waitFor(() => expect(resolve).toBeTypeOf('function'));
    await controller.end();
    resolve();
    await starting;
    expect(vi.getTimerCount()).toBe(0);
    expect(controller.getSnapshot().phase).toBe('ended');
  } finally {
    remote.mockRestore();
    vi.useRealTimers();
  }
});
it('offers retry on autoplay rejection but fences late playback promises after End', async () => {
  const play = vi.fn().mockRejectedValue(new Error('Autoplay blocked'));
  vi.stubGlobal('document', {
    createElement: () => ({ play, pause: vi.fn(), remove: vi.fn(), setAttribute: vi.fn() }),
  });
  const controller = new LiveController();
  await controller.start(conversation, false);
  await controller.enablePlayback();
  expect(controller.getSnapshot().playbackBlocked).toBe(true);
  play.mockResolvedValue(undefined);
  await controller.enablePlayback();
  expect(controller.getSnapshot().playbackBlocked).toBe(false);
  let reject!: (e: Error) => void;
  play.mockImplementation(
    () =>
      new Promise((_resolve, r) => {
        reject = r;
      }),
  );
  const pending = controller.enablePlayback();
  await controller.end();
  reject(new Error('Late rejection'));
  await pending;
  expect(controller.getSnapshot()).toMatchObject({ phase: 'ended', playbackBlocked: false });
});

it('repeats cleanup after a late admission even while the earlier End is still pending', async () => {
  let admit!: (r: Response) => void;
  let finishEarlyEnd!: (r: Response) => void;
  let ends = 0;
  fetchMock.mockImplementation((_url, init) => {
    if (init.method === 'POST')
      return new Promise<Response>((r) => {
        admit = r;
      });
    ends++;
    if (ends === 1)
      return new Promise<Response>((r) => {
        finishEarlyEnd = r;
      });
    return Promise.resolve(Response.json({ ended: true }));
  });
  const controller = new LiveController();
  const starting = controller.start(conversation, false);
  await vi.waitFor(() => expect(admit).toBeTypeOf('function'));
  const ending = controller.end();
  admit(
    Response.json({
      answer: 'v=0\r\na=late',
      expiresAt: new Date(Date.now() + 120000).toISOString(),
    }),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(ends).toBe(1);
  finishEarlyEnd(Response.json({ ended: true }));
  await Promise.all([starting, ending]);
  expect(ends).toBe(2);
  expect(controller.getSnapshot()).toMatchObject({ phase: 'ended', cleanupPending: false });
});
