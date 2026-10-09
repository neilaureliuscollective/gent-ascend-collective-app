import { vi, it, expect, beforeEach } from 'vitest';
vi.mock('server-only', () => ({}));
const s = vi.hoisted(() => ({
  rpc: vi.fn(),
  broker: vi.fn(),
  download: vi.fn(),
  normalize: vi.fn(),
  single: vi.fn(),
  eq: vi.fn(),
  verify: vi.fn(),
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
      rpc: s.rpc,
      storage: { from: () => ({ download: s.download }) },
      from: () => {
        const q = {
          select: () => q,
          eq: (...args: unknown[]) => {
            s.eq(...args);
            return q;
          },
          maybeSingle: s.single,
        };
        return q;
      },
    },
  }),
}));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc: s.broker }) }));
vi.mock('@/domains/technology/image-normalize', () => ({
  normalizeWebsiteImage: s.normalize,
  verifiedImageBytes: s.verify,
}));
import { importImage, readImage } from '@/domains/technology/images';
const command = {
  id: crypto.randomUUID(),
  projectId: crypto.randomUUID(),
  expected: 2,
  sourceId: crypto.randomUUID(),
  kind: 'reference' as const,
  consent: true as const,
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
  s.rpc.mockResolvedValue({ data: 'authenticated/source.png', error: null });
  s.download.mockResolvedValue({ data: new Blob([new Uint8Array(100)]), error: null });
  s.normalize.mockResolvedValue({
    dataUrl: 'data:image/jpeg;base64,/9j/AA==',
    sha256: 'a'.repeat(64),
  });
  s.broker.mockResolvedValue({ data: true, error: null });
});
it('claims a bounded owner/source lease before downloading and finishes through the trusted broker', async () => {
  expect(await importImage(command)).toEqual({ id: command.id });
  expect(s.rpc).toHaveBeenCalledWith(
    'technology_image_begin',
    expect.objectContaining({
      p_project: command.projectId,
      p_expected: 2,
      p_source: command.sourceId,
      p_kind: 'reference',
    }),
  );
  expect(s.download).toHaveBeenCalledWith('authenticated/source.png');
  expect(s.broker).toHaveBeenCalledWith(
    'technology_image_finish',
    expect.objectContaining({ p_owner: 'owner', p_data: 'data:image/jpeg;base64,/9j/AA==' }),
  );
});
it('does no decoding after a denied claim or ready replay', async () => {
  s.rpc.mockResolvedValueOnce({ error: { message: 'private raw SQL' }, data: null });
  await expect(importImage(command)).rejects.toThrow(/refused/);
  expect(s.download).not.toHaveBeenCalled();
  s.rpc.mockResolvedValue({ error: null, data: null });
  await importImage(command);
  expect(s.download).not.toHaveBeenCalled();
});
it('records a failed attempt without automatic retries for decoding errors', async () => {
  s.normalize.mockRejectedValue(new Error('private storage key'));
  await expect(importImage(command)).rejects.toThrow(/could not be prepared/);
  expect(s.normalize).toHaveBeenCalledOnce();
  expect(s.broker).toHaveBeenCalledWith(
    'technology_image_finish',
    expect.objectContaining({ p_data: null, p_hash: null }),
  );
});
it('retains uncertain finish receipts rather than marking success or blindly retrying', async () => {
  s.broker.mockResolvedValue({ data: false, error: null });
  await expect(importImage(command)).rejects.toThrow(/uncertain/);
  expect(s.broker).toHaveBeenCalledOnce();
});
it('loads the owner/project-specific ready asset and verifies bytes before returning them', async () => {
  s.single.mockResolvedValue({
    data: { id: command.id, data_url: 'data', sha256: 'digest' },
    error: null,
  });
  s.verify.mockReturnValue(new Uint8Array([1]));
  await readImage(command.id, command.projectId);
  expect(s.eq).toHaveBeenCalledWith('person_id', 'owner');
  expect(s.eq).toHaveBeenCalledWith('project_id', command.projectId);
  expect(s.eq).toHaveBeenCalledWith('status', 'ready');
  s.verify.mockImplementation(() => {
    throw new Error('bad hash');
  });
  await expect(readImage(command.id)).rejects.toThrow(/verification/);
});
