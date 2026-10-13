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
    ) {
      super(message);
    }
  },
}));
vi.mock('@/domains/intelligence/prompt', () => ({
  aureliusInstructions: 'Synthetic instructions',
  sharedCharacter: 'Synthetic character',
  buildMessages: (turns: unknown[], _text: string, context: unknown) => [
    { role: 'user', content: JSON.stringify({ turns, context }) },
  ],
}));
vi.mock('@/domains/artifacts/service', () => ({
  readArtifacts: async () => ({ artifacts: [], selectedId: null, projects: [] }),
  proposeImage: vi.fn(),
  proposeVisual: vi.fn(),
  proposeCoworker: vi.fn(),
  imageWorkTool: {},
  visualWorkTool: {},
  coworkerWorkTool: {},
}));
vi.mock('@/domains/live/background', () => ({ backgroundTool: {}, runBackgroundTask: vi.fn() }));
import { admitLive } from '@/domains/live/service';
class Socket extends EventTarget {
  static OPEN = 1;
  static last: Socket;
  readyState = 1;
  sent: { item?: { id?: string; content?: { text: string }[] } }[] = [];
  constructor() {
    super();
    Socket.last = this;
    queueMicrotask(() => this.dispatchEvent(new Event('open')));
  }
  send(raw: string) {
    const item = JSON.parse(raw);
    this.sent.push(item);
    if (item.item?.id?.startsWith('ctx_'))
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
  mock.turns.mockResolvedValue([
    {
      id: 'saved-turn',
      parent_turn_id: null,
      user: 'Saved synthetic typed question',
      assistant: 'Saved answer',
    },
  ]);
  mock.context.mockResolvedValue({ profile: 'Opted-in synthetic context' });
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
            : table === 'ai_conversations'
              ? { context_summary: null, archived_at: null, company_id: null }
              : { ended_at: null, conversation_id: input.conversationId };
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
it('does not confirm monitor cleanup when the database does not acknowledge End', async () => {
  const admission = await admitLive(input);
  const monitor = admission.monitor();
  rpc.mockResolvedValue({ data: false, error: null });
  Socket.last.event({ type: 'error', error: { code: 'unknown' } });
  await expect(monitor).rejects.toThrow(/cleanup could not be recorded/);
});
