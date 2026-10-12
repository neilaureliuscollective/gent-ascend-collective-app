import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({
  complete: false,
  unknown: false,
  hasCreation: true,
  rpc: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  render: vi.fn(),
}));
vi.mock('../src/domains/access/current', () => ({
  currentAccess: async () => ({
    has: (cap: string) => cap === 'aurelius.context' || state.hasCreation,
  }),
}));
vi.mock('../src/platform/openai/image', () => ({
  renderImage: state.render,
  ImageGenerationError: class extends Error {
    status = 503;
  },
}));
vi.mock('../src/domains/intelligence/service', () => ({
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
      auth: { getUser: async () => ({ data: { user: { id: 'auth-owner' } } }) },
      from: (table: string) => {
        const q = {
          select: () => q,
          eq: () => q,
          maybeSingle: async () =>
            table === 'ai_studio_versions'
              ? {
                  data: state.complete
                    ? { status: 'complete', storage_key: 'auth-owner/project/request.png' }
                    : { status: 'pending', storage_key: null },
                  error: state.unknown ? { message: 'uncertain' } : null,
                }
              : { data: { id: 'project', company_id: null }, error: null },
          single: async () => ({ data: { brief: {} }, error: null }),
        };
        return q;
      },
      rpc: state.rpc,
      storage: { from: () => ({ upload: state.upload, remove: state.remove }) },
    },
  }),
}));
import { generateStudio } from '../src/domains/studio/service';
const input = {
  id: 'request',
  projectId: 'project',
  parentId: null,
  referenceId: null,
  prompt: 'A synthetic image',
  mode: 'fast' as const,
  size: '1024x1024' as const,
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('OPENAI_API_KEY', 'test-key');
  state.complete = false;
  state.unknown = false;
  state.hasCreation = true;
  state.render.mockResolvedValue(new Uint8Array([1, 2, 3]));
  state.upload.mockResolvedValue({ error: null });
  state.rpc.mockImplementation(async (name: string) =>
    name === 'ai_studio_begin'
      ? { data: true, error: null }
      : { data: null, error: { message: 'lost acknowledgement' } },
  );
});
afterEach(() => vi.unstubAllEnvs());
describe('saved image acknowledgement recovery', () => {
  it('returns an already committed receipt without deleting its original', async () => {
    state.complete = true;
    await expect(generateStudio(input)).resolves.toEqual({ id: 'request' });
    expect(state.remove).not.toHaveBeenCalled();
  });
  it('keeps uncertain saved bytes and refuses to report failed or regenerate automatically', async () => {
    state.unknown = true;
    await expect(generateStudio(input)).rejects.toThrow('save could not be confirmed');
    expect(state.remove).not.toHaveBeenCalled();
    expect(
      state.rpc.mock.calls.filter(
        ([name, args]) => name === 'ai_studio_finish' && args.p_status === 'failed',
      ),
    ).toHaveLength(0);
    expect(state.render).toHaveBeenCalledOnce();
  });
  it('does not consume a reservation without provider configuration or creation entitlement', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    await expect(generateStudio(input)).rejects.toThrow('not connected');
    expect(state.rpc).not.toHaveBeenCalled();
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    state.hasCreation = false;
    await expect(generateStudio(input)).rejects.toThrow('creation requires');
    expect(state.rpc).not.toHaveBeenCalled();
  });
});
