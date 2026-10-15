// Exercises the real admission/sideband service with synthetic Auth, RPC and provider adapters.
// This is not hosted Auth, microphone or provider acceptance.
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mock = vi.hoisted(() => ({
  founder: vi.fn(),
  session: vi.fn(),
  context: vi.fn(),
  turns: vi.fn(),
  access: vi.fn(),
  artifacts: vi.fn(),
  background: vi.fn(),
}));
vi.mock('@/domains/access/founder', () => ({ currentFounderAccess: mock.founder }));
vi.mock('@/domains/access/current', () => ({ currentAccess: mock.access }));
vi.mock('@/domains/intelligence/service', () => ({
  intelligenceSession: mock.session,
  conversationTurns: mock.turns,
  personalContext: mock.context,
  IntelligenceError: class extends Error {
    constructor(
      message: string,
      public status = 400,
      public safeDetail?: Record<string, string | number | null>,
    ) {
      super(message);
    }
  },
}));
vi.mock('@/domains/intelligence/prompt', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/domains/intelligence/prompt')>()),
  aureliusInstructions: 'Synthetic instructions',
  sharedCharacter: 'Synthetic character',
}));
vi.mock('@/domains/commerce/shopify', () => ({ getProduct: async () => null }));
vi.mock('@/domains/commerce/lifestyle-catalog', () => ({
  readLifestyleCatalog: async () => ({ products: [], status: 'unconfigured' }),
}));
vi.mock('@/domains/artifacts/service', () => ({
  readArtifacts: mock.artifacts,
  proposeImage: vi.fn(),
  proposeVisual: vi.fn(),
  proposeCoworker: vi.fn(),
  imageWorkTool: {},
  visualWorkTool: {},
  coworkerWorkTool: {},
}));
vi.mock('@/domains/live/background', () => ({
  backgroundTool: {},
  runBackgroundTask: mock.background,
}));
vi.mock('@/domains/talk-creation/context', () => ({
  selectedTalkContext: async () => '',
  selectedTalkPredecessors: async () => ({}),
}));
vi.mock('@/domains/talk-creation/service', () => ({
  readTalkCreations: async () => ({
    creations: [],
    selected: {},
    images: [],
    selectedImageId: null,
    canCreateImages: false,
    imageAccess: 'unavailable',
    attachmentProjectId: null,
  }),
}));
vi.mock('@/domains/talk-creation/live-adapter', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/domains/talk-creation/live-adapter')>()),
  runTalkLiveOffer: vi.fn(),
  runTalkLiveRefine: vi.fn(),
}));
vi.mock('@/domains/live/trusted-observe', () => ({
  observeTrustedVoiceItem: vi.fn(async () => ({ observed: true, trusted: true })),
}));
import { admitLive } from '@/domains/live/service';
import { liveAdmissionFieldKinds } from '@/domains/live/admission-request';
import { observeTrustedVoiceItem } from '@/domains/live/trusted-observe';
class Socket extends EventTarget {
  static OPEN = 1;
  static last: Socket;
  static lastInit: unknown;
  readyState = 1;
  sent: { item?: { id?: string; content?: { text: string }[] } }[] = [];
  constructor(_url?: string, init?: unknown) {
    super();
    Socket.last = this;
    Socket.lastInit = init;
    queueMicrotask(() => this.dispatchEvent(new Event('open')));
  }
  send(raw: string) {
    const item = JSON.parse(raw);
    this.sent.push(item);
    if (item.type === 'conversation.item.create' && item.item?.type === 'message' && item.item.id)
      queueMicrotask(() => this.event({ type: 'conversation.item.added', item: item.item }));
  }
  event(value: unknown) {
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(value) }));
  }
  close() {
    if (this.readyState !== 1) return;
    this.readyState = 3;
    this.dispatchEvent(new Event('close'));
  }
}
const input = {
  sessionId: 'f1000000-0000-4000-8000-000000000001',
  conversationId: 'f2000000-0000-4000-8000-000000000001',
  sdp: 'v=0\r\na=synthetic-offer',
  includeContext: false,
  saveTranscript: true as const,
  voice: 'cedar' as const,
  backgroundWork: false,
};
let rpc: ReturnType<typeof vi.fn>;
let stillFounder: boolean;
beforeEach(() => {
  vi.clearAllMocks();
  mock.artifacts.mockResolvedValue({ artifacts: [], selectedId: null, projects: [] });
  mock.background.mockResolvedValue({
    text: 'Synthetic approved result',
    input: 1,
    output: 2,
    model: 'synthetic-model',
  });
  for (const [key, value] of Object.entries({
    APP_ENV: 'production',
    VERCEL_ENV: 'production',
    AURELIUS_DEV_HARNESS: 'false',
    NEXT_PUBLIC_SUPABASE_URL: 'https://volpzkfsnmtztrovexcw.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'synthetic-publishable',
    AETHELIOS_LIVE_ENABLED: 'true',
    AETHELIOS_LIVE_FOUNDER_PILOT: 'true',
    AETHELIOS_LIVE_CANONICAL_PILOT: 'true',
    AETHELIOS_LIVE_CONTROL_READY: 'true',
    AETHELIOS_LIVE_EXPIRY_ENABLED: 'true',
    SUPABASE_SERVICE_ROLE_KEY: 'synthetic-worker',
    CRON_SECRET: 'synthetic-only-at-least-32-characters',
    OPENAI_API_KEY: 'synthetic-provider',
  }))
    vi.stubEnv(key, value);
  vi.stubEnv('AETHELIOS_LIVE_PREVIEW_PROJECT_REF', undefined);
  vi.stubEnv('AETHELIOS_LIVE_MODEL', 'gpt-realtime');
  mock.founder.mockResolvedValue(true);
  stillFounder = true;
  mock.access.mockResolvedValue(new Set(['voice.use']));
  vi.mocked(observeTrustedVoiceItem).mockResolvedValue({ observed: true, trusted: true });
  mock.turns.mockResolvedValue([
    {
      id: 'saved-turn',
      parent_turn_id: null,
      status: 'complete',
      user_text: 'Saved synthetic typed question',
      assistant_text: 'Saved answer',
    },
  ]);
  mock.context.mockResolvedValue({ profile: { displayName: 'Opted-in synthetic context' } });
  rpc = vi.fn(async (name: string) => ({
    data: name === 'ai_live_reserve' ? new Date(Date.now() + 120000).toISOString() : true,
    error: null,
  }));
  const client = {
    rpc,
    auth: { getUser: async () => ({ data: { user: { id: 'synthetic-user' } }, error: null }) },
    from: (table: string) => {
      const data =
        table === 'founder_access'
          ? stillFounder
            ? { person_id: 'owner' }
            : null
          : table === 'membership_accounts'
            ? { beta_access: true }
            : table === 'ai_live_jobs'
              ? { status: 'approved' }
              : table === 'ai_conversations'
                ? { context_summary: null, archived_at: null, company_id: null }
                : {
                    ended_at: null,
                    conversation_id: input.conversationId,
                    expires_at: new Date(Date.now() + 120000).toISOString(),
                  };
      const query = {
        select: () => query,
        eq: () => query,
        is: () => query,
        lte: () => query,
        order: () => query,
        limit: async () => ({ data: [], error: null }),
        single: async () => ({ data, error: null }),
        maybeSingle: async () => ({ data, error: null }),
      };
      return query;
    },
  };
  mock.session.mockResolvedValue({ person: { id: 'owner' }, client });
  vi.stubGlobal('WebSocket', Socket);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      url.endsWith('/hangup')
        ? new Response(null, { status: 204 })
        : new Response('v=0\r\na=synthetic-answer', {
            headers: { location: '/v1/realtime/calls/rtc_synthetic' },
          }),
    ),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
it('denies an ordinary beta account before reservations or provider admission', async () => {
  mock.founder.mockResolvedValue(false);
  await expect(admitLive(input)).rejects.toMatchObject({ status: 403 });
  expect(rpc).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
it('opens the official server sideband with an Authorization header rather than the browser protocol', async () => {
  await admitLive(input);
  expect(Socket.lastInit).toEqual({
    headers: { Authorization: 'Bearer synthetic-provider' },
  });
});
it('posts official string FormData fields instead of Blob file parts', async () => {
  await admitLive(input);
  const [, init] = vi.mocked(fetch).mock.calls[0] as [string, { body: FormData }];
  const fields = liveAdmissionFieldKinds(init.body);
  expect(fields.sdpKind).toBe('string');
  expect(fields.sessionKind).toBe('string');
  expect(fields.sdp).toBe(input.sdp);
  const session = JSON.parse(fields.session ?? '');
  expect(session.type).toBe('realtime');
  expect(session.tools.map((tool: { name: string }) => tool.name)).toEqual([
    'offer_text_work',
    'refine_selected_direction',
    'lookup_lifestyle_catalog',
  ]);
  expect(session.instructions).toContain('VOICE DELIVERY');
  expect(session.instructions).toContain('Cached catalog figures are not live stock');
  expect(session.instructions).toContain('Refine the selected design-board direction only');
});
it('reports a sanitized provider rejection instead of one generic connection message', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        error: {
          code: 'invalid_request_error',
          type: 'invalid_request_error',
          param: 'sdp',
          message: 'raw',
        },
        request_id: 'req_test1',
      }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    ),
  );
  await expect(admitLive(input)).rejects.toMatchObject({
    status: 503,
    message: expect.stringMatching(/provider did not complete admission/),
    safeDetail: expect.objectContaining({
      stage: 'provider',
      category: 'rejected',
      providerStatus: 400,
      providerCode: 'invalid_request_error',
      providerParam: 'sdp',
      providerRequestId: 'req_test1',
    }),
  });
  expect(rpc).toHaveBeenCalledWith('ai_live_end', expect.objectContaining({ p_reason: 'failed' }));
});
it('seeds saved typed history before admitting audio, omits private context without consent, and survives cancel races', async () => {
  const admission = await admitLive(input);
  const socket = Socket.last;
  expect(mock.context).not.toHaveBeenCalled();
  expect(JSON.stringify(socket.sent)).toContain('Saved synthetic typed question');
  expect(JSON.stringify(socket.sent)).not.toContain('Opted-in');
  const monitor = admission.monitor();
  socket.event({ type: 'error', error: { code: 'response_cancel_not_active' } });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(socket.readyState).toBe(1);
  for (const event of [
    {
      type: 'conversation.item.added',
      item: { id: 'typed', role: 'user', content: [{ text: 'Typed in Live' }] },
    },
    { type: 'response.created', response: { id: 'reply' } },
    {
      type: 'response.done',
      response: {
        id: 'reply',
        status: 'completed',
        output: [{ content: [{ transcript: 'Spoken answer' }] }],
        usage: { input_tokens: 2, output_tokens: 3 },
      },
    },
    { type: 'output_audio_buffer.stopped', response_id: 'reply' },
  ])
    socket.event(event);
  await vi.waitFor(() =>
    expect(rpc).toHaveBeenCalledWith(
      'ai_finish_turn',
      expect.objectContaining({ p_text: 'Spoken answer', p_status: 'complete' }),
    ),
  );
  expect(rpc).toHaveBeenCalledWith(
    'ai_begin_turn',
    expect.objectContaining({
      p_text: 'Typed in Live',
      p_context: false,
      p_conversation: input.conversationId,
    }),
  );
  socket.event({ type: 'error', error: { code: 'unknown' } });
  await monitor;
  expect(socket.readyState).toBe(3);
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/hangup'),
    expect.objectContaining({ redirect: 'error' }),
  );
});
it('stops the voice session when trusted observation is unavailable instead of treating a saved turn as bound', async () => {
  vi.mocked(observeTrustedVoiceItem).mockResolvedValue({ observed: false, trusted: false });
  const admission = await admitLive(input);
  const socket = Socket.last;
  const monitor = admission.monitor();
  for (const event of [
    {
      type: 'conversation.item.added',
      item: { id: 'typed', role: 'user', content: [{ text: 'Typed in Live' }] },
    },
    { type: 'response.created', response: { id: 'reply' } },
    {
      type: 'response.done',
      response: {
        id: 'reply',
        status: 'completed',
        output: [{ content: [{ transcript: 'Spoken answer' }] }],
        usage: { input_tokens: 2, output_tokens: 3 },
      },
    },
    { type: 'output_audio_buffer.stopped', response_id: 'reply' },
  ])
    socket.event(event);
  await vi.waitFor(() =>
    expect(rpc).toHaveBeenCalledWith(
      'ai_finish_turn',
      expect.objectContaining({ p_text: 'Spoken answer', p_status: 'complete' }),
    ),
  );
  await vi.waitFor(() => expect(socket.readyState).toBe(3));
  expect(rpc.mock.calls.some(([name]) => name === 'ai_live_bind_finished_turn')).toBe(false);
  await monitor;
});

it('includes explicitly opted-in context and ends when founder authority is revoked even if beta remains', async () => {
  vi.useFakeTimers();
  const admission = await admitLive({ ...input, includeContext: true });
  expect(JSON.stringify(Socket.last.sent)).toContain('Opted-in synthetic context');
  const monitor = admission.monitor();
  stillFounder = false;
  await vi.advanceTimersByTimeAsync(5000);
  await monitor;
  expect(Socket.last.readyState).toBe(3);
  expect(rpc).toHaveBeenCalledWith('ai_live_end', expect.any(Object));
});
it('leaves cleanup unconfirmed when provider hangup fails', async () => {
  const admission = await admitLive(input);
  const monitor = admission.monitor();
  vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 503 }));
  Socket.last.event({ type: 'error', error: { code: 'unknown' } });
  await expect(monitor).rejects.toThrow(/cleanup/);
  expect(rpc.mock.calls.some(([name]) => name === 'ai_live_end')).toBe(false);
});
it('reports a missing conversation as a context-stage failure and releases the reservation', async () => {
  const session = await mock.session();
  mock.session.mockResolvedValue({
    person: session.person,
    client: {
      ...session.client,
      from: (table: string) => {
        const query = {
          select: () => query,
          eq: () => query,
          is: () => query,
          lte: () => query,
          order: () => query,
          limit: async () => ({ data: [], error: null }),
          single: async () =>
            table === 'ai_conversations'
              ? { data: null, error: { message: 'missing' } }
              : { data: { ended_at: null, conversation_id: input.conversationId }, error: null },
          maybeSingle: async () => ({ data: null, error: null }),
        };
        return query;
      },
    },
  });
  await expect(admitLive(input)).rejects.toMatchObject({
    safeDetail: expect.objectContaining({ stage: 'context', category: 'unavailable' }),
  });
  expect(rpc).toHaveBeenCalledWith('ai_live_end', expect.objectContaining({ p_reason: 'failed' }));
  expect(fetch).not.toHaveBeenCalled();
});
it('does not hang up an invalid provider call id', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(
    new Response('v=0', { headers: { location: '/v1/realtime/calls/not-a-call' } }),
  );
  await expect(admitLive(input)).rejects.toMatchObject({
    safeDetail: expect.objectContaining({ stage: 'call-id', category: 'invalid-response' }),
  });
  expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/hangup'))).toBe(false);
  expect(rpc).toHaveBeenCalledWith('ai_live_end', expect.objectContaining({ p_reason: 'failed' }));
});
it('hangs up and ends the reservation when session attachment fails', async () => {
  rpc.mockImplementation(async (name: string) =>
    name === 'ai_live_attach'
      ? { data: false, error: null }
      : {
          data: name === 'ai_live_reserve' ? new Date(Date.now() + 120000).toISOString() : true,
          error: null,
        },
  );
  await expect(admitLive(input)).rejects.toMatchObject({
    safeDetail: expect.objectContaining({ stage: 'attachment', category: 'unavailable' }),
  });
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/hangup'),
    expect.objectContaining({ redirect: 'error' }),
  );
  expect(rpc).toHaveBeenCalledWith('ai_live_end', expect.objectContaining({ p_reason: 'failed' }));
});
it('reports a sideband timeout when the control socket never opens', async () => {
  class SilentSocket extends EventTarget {
    readyState = 0;
    send() {}
    close() {
      this.readyState = 3;
    }
  }
  vi.stubGlobal('WebSocket', SilentSocket);
  vi.useFakeTimers();
  const pending = expect(admitLive(input)).rejects.toMatchObject({
    safeDetail: expect.objectContaining({ stage: 'sideband', category: 'timeout' }),
  });
  await vi.advanceTimersByTimeAsync(10000);
  await pending;
});

it('does not confirm monitor cleanup when the database does not acknowledge End', async () => {
  const admission = await admitLive(input);
  const monitor = admission.monitor();
  rpc.mockResolvedValue({ data: false, error: null });
  Socket.last.event({ type: 'error', error: { code: 'unknown' } });
  await expect(monitor).rejects.toThrow(/cleanup could not be recorded/);
});

it('preserves allowlisted correlated seed rejection details and cleans up the admitted call', async () => {
  const original = Socket.prototype.send;
  const spy = vi.spyOn(Socket.prototype, 'send').mockImplementation(function (
    this: Socket,
    raw: string,
  ) {
    const sent = JSON.parse(raw);
    if (sent.item?.role === 'assistant') {
      queueMicrotask(() =>
        this.event({
          type: 'error',
          error: {
            event_id: sent.event_id,
            code: 'invalid_value',
            type: 'invalid_request_error',
            param: 'item.content[0].type',
            message: 'PRIVATE CONTEXT MUST NOT LEAK',
          },
        }),
      );
    } else original.call(this, raw);
  });
  try {
    await expect(admitLive(input)).rejects.toMatchObject({
      safeDetail: expect.objectContaining({
        stage: 'seed',
        category: 'rejected',
        providerCode: 'invalid_value',
        providerType: 'invalid_request_error',
        providerParam: 'item.content[0].type',
        seedIndex: 2,
        seedRole: 'assistant',
        seedLength: 12,
        seedEventId: expect.stringMatching(/^seed_[a-f0-9]+$/),
      }),
    });
    expect(Socket.last.readyState).toBe(3);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/hangup'), expect.any(Object));
    expect(rpc).toHaveBeenCalledWith(
      'ai_live_end',
      expect.objectContaining({ p_reason: 'failed' }),
    );
  } finally {
    spy.mockRestore();
  }
});

it('does not report a stale sideband-open failure when an admitted socket later closes', async () => {
  const log = vi.spyOn(console, 'info').mockImplementation(() => {});
  try {
    const admission = await admitLive(input);
    const monitor = admission.monitor();
    Socket.last.close();
    await monitor;
    expect(
      log.mock.calls.some(
        ([name, detail]) => name === 'live-admission' && detail.stage === 'sideband',
      ),
    ).toBe(false);
  } finally {
    log.mockRestore();
  }
});

it('seeds real multirole history with compact IDs and independently correlated events', async () => {
  await admitLive(input);
  const items = Socket.last.sent as {
    event_id?: string;
    item?: { id?: string; role?: string; content?: { type?: string; text: string }[] };
  }[];
  const messages = items.filter((x) => x.item?.id);
  expect(messages.map((x) => x.item?.role)).toEqual(['user', 'user', 'assistant']);
  expect(new Set(messages.map((x) => x.item?.id)).size).toBe(messages.length);
  for (const item of messages) {
    expect(item.item?.id).toMatch(/^c[0-9a-z]{25}$/);
    expect(item.event_id).toMatch(/^seed_[a-f0-9]{32}$/);
  }
  expect(messages[1]?.item?.content).toEqual([
    { type: 'input_text', text: 'Saved synthetic typed question' },
  ]);
  expect(messages[2]?.item?.content).toEqual([{ type: 'output_text', text: 'Saved answer' }]);
});
for (const fail of [false, true])
  it(`uses compact IDs for background ${fail ? 'failure' : 'completion'} messages`, async () => {
    vi.useFakeTimers();
    if (fail) mock.background.mockRejectedValueOnce(new Error('Synthetic task failure'));
    const admission = await admitLive({ ...input, backgroundWork: true });
    const socket = Socket.last;
    const initial = socket.sent.length;
    const monitor = admission.monitor();
    socket.event({
      type: 'response.function_call_arguments.done',
      name: 'request_background_work',
      call_id: 'synthetic-background',
      arguments: JSON.stringify({ task: 'Synthetic approved task', coworker: null }),
    });
    await vi.advanceTimersByTimeAsync(1000);
    const messages = socket.sent.slice(initial).filter((x) => x.item?.id);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.item?.id).toMatch(/^c[0-9a-z]{25}$/);
    expect(messages[0]?.item?.content?.[0]?.text).toContain(
      fail ? 'approved background work failed' : 'Synthetic approved result',
    );
    socket.close();
    await monitor;
  });
it('uses compact IDs for changed selection and saved artifact messages', async () => {
  vi.useFakeTimers();
  const admission = await admitLive(input);
  const socket = Socket.last;
  const initial = socket.sent.length;
  const monitor = admission.monitor();
  mock.artifacts.mockResolvedValue({
    artifacts: [
      {
        id: 'synthetic-image',
        status: 'complete',
        visual: null,
        version_id: 'synthetic-version',
        project_id: null,
        prompt: 'Synthetic image',
      },
    ],
    selectedId: 'synthetic-image',
    projects: [],
  });
  await vi.advanceTimersByTimeAsync(3000);
  const messages = socket.sent.slice(initial).filter((x) => x.item?.id);
  expect(messages).toHaveLength(2);
  expect(new Set(messages.map((x) => x.item?.id)).size).toBe(2);
  for (const message of messages) expect(message.item?.id).toMatch(/^c[0-9a-z]{25}$/);
  expect(messages[0]?.item?.content?.[0]?.text).toContain('Application selection changed');
  expect(messages[1]?.item?.content?.[0]?.text).toContain('Application saved image result');
  socket.close();
  await monitor;
});

it('refreshes working state after a trusted mid-call correction without starting a spoken reply', async () => {
  const admission = await admitLive(input);
  const socket = Socket.last;
  const createCount = (value: unknown) =>
    (JSON.stringify(value).match(/"type":"response.create"/g) ?? []).length;
  const initialCreates = createCount(socket.sent);
  const monitor = admission.monitor();
  for (const event of [
    {
      type: 'conversation.item.added',
      item: {
        id: 'typed-correction',
        role: 'user',
        content: [{ text: 'No — the audience is operators, not consumers' }],
      },
    },
    { type: 'response.created', response: { id: 'reply-correction' } },
    {
      type: 'response.done',
      response: {
        id: 'reply-correction',
        status: 'completed',
        output: [{ content: [{ transcript: 'I will write for operators.' }] }],
        usage: { input_tokens: 2, output_tokens: 3 },
      },
    },
    { type: 'output_audio_buffer.stopped', response_id: 'reply-correction' },
  ])
    socket.event(event);
  await vi.waitFor(() =>
    expect(rpc).toHaveBeenCalledWith(
      'ai_finish_turn',
      expect.objectContaining({ p_text: 'I will write for operators.', p_status: 'complete' }),
    ),
  );
  await vi.waitFor(() =>
    expect(rpc).toHaveBeenCalledWith(
      'ai_live_bind_finished_turn',
      expect.objectContaining({ p_item: 'typed-correction' }),
    ),
  );
  await vi.waitFor(() =>
    expect(JSON.stringify(socket.sent)).toContain('Application working-state refresh'),
  );
  expect(JSON.stringify(socket.sent)).toMatch(/operators/i);
  expect(createCount(socket.sent)).toBe(initialCreates);
  expect(JSON.stringify(socket.sent)).toContain('not authorization');
  socket.close();
  await monitor;
});

it('does not persist compact or legacy context notifications, and preserves the next real voice turn', async () => {
  const admission = await admitLive(input);
  const socket = Socket.last;
  const monitor = admission.monitor();
  for (const id of ['c' + '0'.repeat(25), 'ctx_legacy']) {
    socket.event({
      type: 'conversation.item.added',
      item: { id, role: 'user', content: [{ text: 'Synthetic internal notification' }] },
    });
    socket.event({ type: 'response.created', response: { id: 'response-' + id } });
    socket.event({
      type: 'response.done',
      response: {
        id: 'response-' + id,
        status: 'completed',
        output: [{ content: [{ transcript: 'Synthetic notification answer' }] }],
      },
    });
    socket.event({ type: 'output_audio_buffer.stopped', response_id: 'response-' + id });
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(rpc.mock.calls.some(([name]) => name === 'ai_begin_turn')).toBe(false);
  for (const event of [
    { type: 'input_audio_buffer.committed', item_id: 'item-real-human' },
    {
      type: 'conversation.item.input_audio_transcription.completed',
      item_id: 'item-real-human',
      transcript: 'Application context is my actual question',
    },
    { type: 'response.created', response: { id: 'real-reply' } },
    {
      type: 'response.done',
      response: {
        id: 'real-reply',
        status: 'completed',
        output: [{ content: [{ transcript: 'Actual reply' }] }],
      },
    },
    { type: 'output_audio_buffer.stopped', response_id: 'real-reply' },
  ])
    socket.event(event);
  await vi.waitFor(() =>
    expect(rpc).toHaveBeenCalledWith(
      'ai_begin_turn',
      expect.objectContaining({ p_text: 'Application context is my actual question' }),
    ),
  );
  socket.close();
  await monitor;
  expect(rpc.mock.calls.filter(([name]) => name === 'ai_begin_turn')).toHaveLength(1);
});
