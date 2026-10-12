import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({
  complete: false,
  eligible: true,
  filters: [] as unknown[][],
  rpc: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  render: vi.fn(),
  download: vi.fn(),
  created: '2000-01-01T00:00:00Z',
}));
vi.mock('../src/domains/access/current', () => ({
  currentAccess: async () => ({ has: () => state.eligible }),
}));
vi.mock('../src/platform/openai/narration', () => ({ renderNarration: state.render }));
vi.mock('../src/domains/studio/service', () => ({
  verifyStudioProject: async () => ({ id: 'project' }),
  studioSession: async () => ({
    person: { id: 'owner' },
    client: {
      auth: { getUser: async () => ({ data: { user: { id: 'auth-owner' } } }) },
      rpc: state.rpc,
      from: (table: string) => {
        const q = {
          select: () => q,
          eq: (...args: unknown[]) => {
            state.filters.push([table, ...args]);
            return q;
          },
          maybeSingle: async () => ({
            data: {
              status: state.complete ? 'complete' : 'pending',
              storage_key: state.complete ? 'auth-owner/project/request.wav' : null,
              created_at: state.created,
              project_id: 'project',
            },
            error: null,
          }),
        };
        return q;
      },
      storage: {
        from: () => ({ upload: state.upload, remove: state.remove, download: state.download }),
      },
    },
  }),
}));
import {
  generateNarration,
  recoverNarration,
  narrationBlob,
} from '../src/domains/studio/narration-service';
const input = {
  id: 'request',
  projectId: 'project',
  title: 'Clip',
  script: 'Made with intention.',
  voice: 'alloy' as const,
  tone: 'clear' as const,
  approved: true as const,
};
beforeEach(() => {
  vi.clearAllMocks();
  state.complete = false;
  state.eligible = true;
  state.filters = [];
  state.created = '2000-01-01T00:00:00Z';
  vi.stubEnv('OPENAI_API_KEY', 'test-key');
  vi.stubEnv('STUDIO_NARRATION_ENABLED', 'true');
  state.render.mockResolvedValue({ bytes: new Uint8Array([1, 2]), duration: 1 });
  state.upload.mockResolvedValue({ error: null });
  state.rpc.mockImplementation(async (name: string) =>
    name === 'ai_studio_narration_begin'
      ? { data: true, error: null }
      : { data: null, error: { message: 'lost acknowledgement' } },
  );
});
afterEach(() => vi.unstubAllEnvs());
describe('Narration acknowledgement and private sources', () => {
  it('recovers a committed receipt without deleting bytes or sending a second paid request', async () => {
    state.complete = true;
    await expect(generateNarration(input)).resolves.toEqual({ id: 'request' });
    expect(state.render).toHaveBeenCalledOnce();
    expect(state.remove).not.toHaveBeenCalled();
    expect(state.filters).toEqual(
      expect.arrayContaining([
        ['ai_studio_narrations', 'person_id', 'owner'],
        ['ai_studio_narrations', 'project_id', 'project'],
      ]),
    );
  });
  it('preserves uncertain uploads and reservations until explicit recovery', async () => {
    state.upload.mockResolvedValue({ error: { message: 'ambiguous' } });
    await expect(generateNarration(input)).rejects.toThrow('save could not be confirmed');
    expect(state.remove).not.toHaveBeenCalled();
    expect(
      state.rpc.mock.calls.filter(
        ([name, args]) => name === 'ai_studio_narration_finish' && args.p_status === 'failed',
      ),
    ).toHaveLength(0);
  });
  it('never reserves or generates when disabled, missing credentials or ineligible', async () => {
    vi.stubEnv('STUDIO_NARRATION_ENABLED', 'false');
    await expect(generateNarration(input)).rejects.toThrow('not enabled');
    vi.stubEnv('STUDIO_NARRATION_ENABLED', 'true');
    vi.stubEnv('OPENAI_API_KEY', '');
    await expect(generateNarration(input)).rejects.toThrow('not enabled');
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    state.eligible = false;
    await expect(generateNarration(input)).rejects.toThrow('eligible');
    expect(state.rpc).not.toHaveBeenCalled();
    expect(state.render).not.toHaveBeenCalled();
  });
  it('does not replace an uncertain private file read with a failed receipt', async () => {
    state.download.mockResolvedValue({ data: null, error: { statusCode: '503' } });
    await expect(recoverNarration('request', 'project')).rejects.toThrow('Nothing was changed');
    expect(state.rpc).not.toHaveBeenCalled();
    expect(state.render).not.toHaveBeenCalled();
  });
  it('waits beyond the bounded generation lifetime before recovering a missing file', async () => {
    state.created = new Date().toISOString();
    await expect(recoverNarration('request', 'project')).rejects.toThrow('Wait ten minutes');
    expect(state.download).not.toHaveBeenCalled();
    state.created = '2000-01-01T00:00:00Z';
    state.download.mockResolvedValue({ data: null, error: { statusCode: '404' } });
    state.rpc.mockResolvedValue({ data: true, error: null });
    await expect(recoverNarration('request', 'project')).resolves.toEqual({ id: 'request' });
    expect(state.rpc).toHaveBeenCalledWith('ai_studio_narration_finish', {
      p_id: 'request',
      p_status: 'failed',
    });
    expect(state.render).not.toHaveBeenCalled();
  });
  it('reads a completed clip only through its exact owner Storage path', async () => {
    state.complete = true;
    state.download.mockResolvedValue({ data: new Blob(['fixture']), error: null });
    await narrationBlob('request');
    expect(state.download).toHaveBeenCalledWith('auth-owner/project/request.wav');
    expect(state.filters).toContainEqual(['ai_studio_narrations', 'person_id', 'owner']);
  });
});
