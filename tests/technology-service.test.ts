import { beforeEach, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({
  reserveError: false,
  generate: vi.fn(),
  broker: vi.fn(),
  sessionRpc: vi.fn(),
  brief: {
    name: 'Studio North',
    industry: 'grooming-beauty',
    vision: 'A welcoming local grooming studio.',
    headline: 'Care with intention',
    about: 'A local studio focused on thoughtful care.',
    services: [{ name: 'Haircut', description: 'An attentive appointment.', price: '$45' }],
    hours: 'Tue–Sat',
    contact: 'Call the studio',
    bookingUrl: '',
  },
}));
vi.mock('@/domains/intelligence/service', () => ({
  IntelligenceError: class extends Error {
    constructor(
      message: string,
      public status = 400,
    ) {
      super(message);
    }
  },
  intelligenceSession: async () => ({
    person: { id: 'owner' },
    client: {
      from: () => {
        const q = {
          select: () => q,
          eq: () => q,
          maybeSingle: async () => ({ data: { brief: state.brief }, error: null }),
        };
        return q;
      },
      rpc: state.sessionRpc,
    },
  }),
}));
vi.mock('@/domains/access/founder', () => ({ currentFounderAccess: async () => false }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc: state.broker }) }));
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: () => ({ responses: (model: string) => model }),
}));
vi.mock('ai', () => ({ generateText: state.generate, Output: { object: () => ({}) } }));
import { mutateTechnology } from '@/domains/technology/service';
const command = {
  action: 'generate' as const,
  id: 'project',
  runId: 'run',
  expected: 1,
  consent: true as const,
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('OPENAI_API_KEY', 'synthetic');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
  state.sessionRpc.mockResolvedValue({ error: null, data: 'run' });
  state.broker.mockResolvedValue({ error: null, data: 'version' });
  state.generate.mockResolvedValue({
    output: state.brief,
    usage: { inputTokens: 1200, outputTokens: 800 },
  });
});
it('cannot spend after a denied reservation', async () => {
  state.sessionRpc.mockResolvedValue({ error: { message: 'denied' } });
  await expect(mutateTechnology(command)).rejects.toThrow(/Generation refused/);
  expect(state.generate).not.toHaveBeenCalled();
  expect(state.broker).not.toHaveBeenCalled();
});
it('uses one bounded provider call and trusted settlement, without personal context', async () => {
  expect(await mutateTechnology(command)).toEqual({ versionId: 'version' });
  expect(state.generate).toHaveBeenCalledOnce();
  const args = state.generate.mock.calls[0]![0];
  expect(args.maxRetries).toBe(0);
  expect(args.maxOutputTokens).toBe(4000);
  expect(args.prompt).toBe(JSON.stringify(state.brief));
  expect(state.broker).toHaveBeenCalledWith(
    'technology_settle',
    expect.objectContaining({ p_owner: 'owner', p_input: 1200, p_output: 800 }),
  );
});
it('retains unknown outcomes with no retry or refund', async () => {
  state.generate.mockRejectedValue(new Error('timeout'));
  await expect(mutateTechnology(command)).rejects.toThrow(/reconciliation/);
  expect(state.generate).toHaveBeenCalledOnce();
  expect(state.broker).toHaveBeenCalledWith(
    'technology_settle',
    expect.objectContaining({ p_brief: null, p_input: null, p_output: null }),
  );
});
it('refuses invented confirmed facts', async () => {
  state.generate.mockResolvedValue({
    output: { ...state.brief, contact: 'Invented address' },
    usage: { inputTokens: 1, outputTokens: 1 },
  });
  await expect(mutateTechnology(command)).rejects.toThrow(/reconciliation/);
  expect(state.broker).toHaveBeenCalledWith(
    'technology_settle',
    expect.objectContaining({ p_brief: null }),
  );
});
it('does not claim settlement succeeded when the database retains the reservation', async () => {
  state.broker.mockResolvedValue({ error: null, data: 'run' });
  await expect(mutateTechnology(command)).rejects.toThrow(/reconciliation/);
});
it('applies a natural-language design request with the same reservation and records its source', async () => {
  const design = {
    palette: 'ivory',
    hero: 'centered',
    typography: 'serif',
    spacing: 'spacious',
    audience: '',
    goal: '',
    rationale: 'A quieter editorial hierarchy.',
    cta: 'Explore services',
    request: '',
  };
  state.generate.mockResolvedValue({
    output: { ...state.brief, design },
    usage: { inputTokens: 1000, outputTokens: 700 },
  });
  await mutateTechnology({ ...command, instruction: 'Make the homepage more luxurious.' });
  expect(state.generate.mock.calls[0]![0].prompt).toContain('Make the homepage more luxurious.');
  expect(state.sessionRpc).toHaveBeenCalledWith(
    'technology_reserve',
    expect.objectContaining({ p_expected: 1 }),
  );
  expect(state.broker).toHaveBeenCalledWith(
    'technology_settle',
    expect.objectContaining({
      p_brief: expect.objectContaining({
        design: expect.objectContaining({ request: 'Make the homepage more luxurious.' }),
      }),
    }),
  );
});
it('a conversational request cannot change confirmed prices or remove services', async () => {
  state.generate.mockResolvedValue({
    output: { ...state.brief, services: [{ ...state.brief.services[0], price: '$999' }] },
    usage: { inputTokens: 1, outputTokens: 1 },
  });
  await expect(mutateTechnology({ ...command, instruction: 'Change everything.' })).rejects.toThrow(
    /reconciliation/,
  );
  expect(state.broker).toHaveBeenCalledWith(
    'technology_settle',
    expect.objectContaining({ p_brief: null }),
  );
});
