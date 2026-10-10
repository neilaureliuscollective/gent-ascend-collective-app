import { vi, it, expect, beforeEach } from 'vitest';
vi.mock('server-only', () => ({}));
const s = vi.hoisted(() => ({
  single: vi.fn(),
  rpc: vi.fn(),
  eq: vi.fn(),
  manifest: vi.fn(),
  artifact: vi.fn(),
  packet: vi.fn(),
}));
vi.mock('@/domains/intelligence/service', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/domains/intelligence/service')>();
  return {
    ...original,
    intelligenceSession: async () => ({
      person: { id: 'f7200000-0000-4000-8000-000000000001' },
      client: {
        rpc: s.rpc,
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
  };
});
vi.mock('@/domains/technology/publication', () => ({ preparePublication: s.manifest }));
vi.mock('@/domains/technology/build-service', () => ({ exportBuild: s.artifact }));
vi.mock('@/domains/technology/release-package', () => ({ createReleasePackage: s.packet }));
import { mutateRelease, downloadRelease } from '@/domains/technology/releases';
const id = 'f7200000-0000-4000-8000-000000000002',
  build = 'f7200000-0000-4000-8000-000000000003';
const row = {
  id,
  build_id: build,
  project_id: 'project',
  version_id: 'version',
  revision: 1,
  sha256: 'a'.repeat(64),
  revoked_at: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  s.manifest.mockResolvedValue({
    projectId: 'project',
    versionId: 'version',
    revision: 1,
    sha256: 'a'.repeat(64),
  });
  s.rpc.mockResolvedValue({ data: id, error: null });
  s.single.mockResolvedValue({ data: row, error: null });
  s.artifact.mockResolvedValue({ html: 'verified' });
  s.packet.mockReturnValue({ bytes: new Uint8Array([1]) });
});
it('verifies exact artifact before saving consent with the user session', async () => {
  expect(
    await mutateRelease({
      action: 'approve',
      id,
      buildId: build,
      sha256: 'a'.repeat(64),
      consent: true,
    }),
  ).toEqual({ id });
  expect(s.manifest).toHaveBeenCalledWith(build);
  expect(s.rpc).toHaveBeenCalledWith('technology_release_approve', {
    p_id: id,
    p_build: build,
    p_hash: 'a'.repeat(64),
    p_consent: true,
  });
});
it('refuses a changed hash before approval and preserves uncertain RPC writes for reload', async () => {
  await expect(
    mutateRelease({ action: 'approve', id, buildId: build, sha256: 'b'.repeat(64), consent: true }),
  ).rejects.toThrow(/changed/);
  expect(s.rpc).not.toHaveBeenCalled();
  s.rpc.mockResolvedValue({ error: { message: 'private error' } });
  await expect(
    mutateRelease({ action: 'approve', id, buildId: build, sha256: 'a'.repeat(64), consent: true }),
  ).rejects.toThrow(/reload/);
});
it('downloads only owner-bound exact reviewed releases and rechecks revocation', async () => {
  await downloadRelease(id);
  expect(s.eq).toHaveBeenCalledWith('person_id', 'f7200000-0000-4000-8000-000000000001');
  expect(s.single).toHaveBeenCalledTimes(2);
  expect(s.packet).toHaveBeenCalledWith(row, 'verified');
});
it('denies missing, revoked and mismatched records before package creation', async () => {
  s.single.mockResolvedValueOnce({ data: null, error: null });
  await expect(downloadRelease(id)).rejects.toThrow(/not found/);
  s.single.mockResolvedValueOnce({ data: { ...row, revoked_at: 'now' }, error: null });
  await expect(downloadRelease(id)).rejects.toThrow(/revoked/);
  s.manifest.mockResolvedValueOnce({
    projectId: 'another',
    versionId: 'version',
    revision: 1,
    sha256: row.sha256,
  });
  await expect(downloadRelease(id)).rejects.toThrow(/changed/);
  expect(s.packet).not.toHaveBeenCalled();
});
it('blocks download when approval is revoked while the artifact is being read', async () => {
  s.single
    .mockResolvedValueOnce({ data: row, error: null })
    .mockResolvedValueOnce({ data: { revoked_at: 'now' }, error: null });
  await expect(downloadRelease(id)).rejects.toThrow(/unavailable/);
  expect(s.packet).not.toHaveBeenCalled();
});
it('revokes with an owner-scoped RPC and reports a denied receipt', async () => {
  await mutateRelease({ action: 'revoke', id });
  expect(s.rpc).toHaveBeenCalledWith('technology_release_revoke', { p_id: id });
  s.rpc.mockResolvedValueOnce({ error: {} });
  await expect(mutateRelease({ action: 'revoke', id })).rejects.toThrow(/unavailable/);
});
