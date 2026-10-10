import { beforeEach, it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
vi.mock('server-only', () => ({}));
const s = vi.hoisted(() => ({
  rpc: vi.fn(),
  broker: vi.fn(),
  single: vi.fn(),
  eq: vi.fn(),
  brief: {
    name: 'Studio North',
    industry: 'grooming-beauty',
    vision: 'A considered local studio.',
    headline: 'Care with intention',
    about: 'A carefully considered local studio.',
    services: [{ name: 'Consultation', price: '$45', description: 'Thoughtful service.' }],
    hours: '',
    contact: '',
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
      rpc: s.rpc,
      from: () => {
        const q = {
          select: () => q,
          eq: (...args: unknown[]) => {
            s.eq(...args);
            return q;
          },
          single: s.single,
        };
        return q;
      },
    },
  }),
}));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc: s.broker }) }));
import { mutateBuild, exportBuild } from '@/domains/technology/build-service';
import { renderArtifact } from '@/domains/technology/artifact';
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
  s.rpc.mockResolvedValue({ data: true, error: null });
  s.broker.mockResolvedValue({ data: true, error: null });
});
it('never starts an executor from a queue command', async () => {
  s.rpc.mockResolvedValue({ data: 'build', error: null });
  expect(
    await mutateBuild({ action: 'queue', id: 'build', projectId: 'project', versionId: 'version' }),
  ).toEqual({ id: 'build' });
  expect(s.broker).not.toHaveBeenCalled();
  expect(s.single).not.toHaveBeenCalled();
});
it('reuses a finished receipt without compiling or settling twice', async () => {
  s.rpc.mockResolvedValue({ data: false, error: null });
  await mutateBuild({ action: 'resume', id: 'build' });
  expect(s.single).not.toHaveBeenCalled();
  expect(s.broker).not.toHaveBeenCalled();
});
it('settles only a claimed owned immutable source with checks/hash', async () => {
  s.single
    .mockResolvedValueOnce({ data: { project_id: 'project', version_id: 'version' }, error: null })
    .mockResolvedValueOnce({
      data: { project_id: 'project', template_version: 'service-business-v1', brief: s.brief },
      error: null,
    });
  await mutateBuild({ action: 'resume', id: 'build' });
  expect(s.broker).toHaveBeenCalledWith(
    'technology_build_finish',
    expect.objectContaining({
      p_owner: 'owner',
      p_hash: createHash('sha256')
        .update(renderArtifact(s.brief as Parameters<typeof renderArtifact>[0]))
        .digest('hex'),
      p_checks: expect.objectContaining({ passed: true }),
    }),
  );
  expect(s.eq).toHaveBeenCalledWith('person_id', 'owner');
});
it('cannot settle a mismatched source and does not release the lease', async () => {
  s.single
    .mockResolvedValueOnce({ data: { project_id: 'project', version_id: 'version' }, error: null })
    .mockResolvedValueOnce({
      data: { project_id: 'other', template_version: 'service-business-v1', brief: s.brief },
      error: null,
    });
  await expect(mutateBuild({ action: 'resume', id: 'build' })).rejects.toThrow(/source/);
  expect(s.broker).not.toHaveBeenCalled();
});
it('rejects hash-corrupted exports, even if ready', async () => {
  s.single.mockResolvedValue({
    data: {
      status: 'ready',
      html: renderArtifact(s.brief as Parameters<typeof renderArtifact>[0]),
      sha256: 'a'.repeat(64),
    },
    error: null,
  });
  await expect(exportBuild('build')).rejects.toThrow(/verification/);
  expect(s.eq).toHaveBeenCalledWith('person_id', 'owner');
});
it('redacts inaccessible exports', async () => {
  s.single.mockResolvedValue({ data: null, error: { message: 'private database detail' } });
  await expect(exportBuild('build')).rejects.toThrow('Ready build not found.');
});
