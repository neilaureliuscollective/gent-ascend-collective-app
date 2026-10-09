import { vi, it, expect, beforeEach } from 'vitest';
vi.mock('server-only', () => ({}));
const s = vi.hoisted(() => ({ single: vi.fn(), export: vi.fn(), eq: vi.fn() }));
vi.mock('@/domains/intelligence/service', () => ({
  IntelligenceError: class extends Error {},
  intelligenceSession: async () => ({
    person: { id: 'f6300000-0000-4000-8000-000000000001' },
    client: {
      from: () => {
        const q = {
          select: () => q,
          eq: (...a: unknown[]) => {
            s.eq(...a);
            return q;
          },
          maybeSingle: s.single,
        };
        return q;
      },
    },
  }),
}));
vi.mock('@/domains/technology/build-service', () => ({ exportBuild: s.export }));
import { preparePublication } from '@/domains/technology/publication';
const id = 'f6300000-0000-4000-8000-000000000002',
  project = 'f6300000-0000-4000-8000-000000000003',
  version = 'f6300000-0000-4000-8000-000000000004';
beforeEach(() => {
  vi.clearAllMocks();
  s.single
    .mockResolvedValueOnce({
      data: { id, project_id: project, version_id: version, status: 'ready' },
      error: null,
    })
    .mockResolvedValueOnce({
      data: { id: version, revision: 2, reviewed_at: '2026-10-09T00:00:00Z' },
      error: null,
    });
  s.export.mockResolvedValue({ hash: 'a'.repeat(64), html: 'verified' });
});
it('binds a private reviewed build to exact version/hash with publishing and spending disabled', async () => {
  const r = await preparePublication(id);
  expect(r).toMatchObject({
    projectId: project,
    versionId: version,
    revision: 2,
    sha256: 'a'.repeat(64),
    publishEnabled: false,
    budgetMicros: 0,
    domain: null,
    approval: 'required',
  });
  expect(s.eq).toHaveBeenCalledWith('person_id', 'f6300000-0000-4000-8000-000000000001');
  expect(s.export).toHaveBeenCalledWith(id);
});
it('rejects foreign/missing builds before preparing anything', async () => {
  s.single.mockReset().mockResolvedValue({ data: null, error: null });
  await expect(preparePublication(id)).rejects.toThrow(/not found/);
  expect(s.export).not.toHaveBeenCalled();
});
it('fails closed when the existing artifact/hash verification fails', async () => {
  s.export.mockRejectedValue(new Error('Corrupt hash'));
  await expect(preparePublication(id)).rejects.toThrow(/hash/);
});
