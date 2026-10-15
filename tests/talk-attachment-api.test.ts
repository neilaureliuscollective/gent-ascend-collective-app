import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mock = vi.hoisted(() => ({ prepare: vi.fn(), complete: vi.fn(), select: vi.fn() }));
vi.mock('@/domains/talk-creation/service', () => ({
  prepareTalkAttachment: mock.prepare,
  completeTalkAttachment: mock.complete,
}));
vi.mock('@/domains/studio/reference-selection', () => ({ selectStudioReference: mock.select }));
import { POST } from '@/app/api/aurelius/attachments/route';
import { studioInput } from '@/domains/studio/service';
function request(body: unknown) {
  return new Request('https://app.test/api/aurelius/attachments', {
    method: 'POST',
    headers: { origin: 'https://app.test', host: 'app.test', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
beforeEach(() => vi.clearAllMocks());
it('rejects ambiguous Studio sources while accepting a version, reference or new-image request', () => {
  const input = {
    id: '10000000-0000-4000-8000-000000000001',
    projectId: '10000000-0000-4000-8000-000000000002',
    parentId: '10000000-0000-4000-8000-000000000003',
    referenceId: '10000000-0000-4000-8000-000000000004',
    prompt: 'Develop the selected source',
    mode: 'fast',
    size: '1024x1024',
  };
  expect(studioInput.safeParse(input).success).toBe(false);
  expect(studioInput.safeParse({ ...input, referenceId: null }).success).toBe(true);
  expect(studioInput.safeParse({ ...input, parentId: null }).success).toBe(true);
  expect(studioInput.safeParse({ ...input, parentId: null, referenceId: null }).success).toBe(true);
});
it('rejects unsupported uploads and oversize requests before preparing storage', async () => {
  for (const body of [
    { action: 'prepare', mediaType: 'video/mp4', byteSize: 128 },
    { action: 'prepare', mediaType: 'image/png', byteSize: 10485761 },
    { action: 'prepare', mediaType: 'image/png', byteSize: 128, personId: 'forged' },
  ])
    expect((await POST(request(body))).status).toBe(400);
  expect(mock.prepare).not.toHaveBeenCalled();
});
it('only forwards validated owned-reference handoff identifiers; it cannot select a caller owner', async () => {
  const projectId = '10000000-0000-4000-8000-000000000001';
  const id = '10000000-0000-4000-8000-000000000002';
  expect((await POST(request({ action: 'studio', projectId: 'invalid', id }))).status).toBe(400);
  expect((await POST(request({ action: 'studio', projectId, id, ownerId: 'forged' }))).status).toBe(
    400,
  );
  expect(mock.select).not.toHaveBeenCalled();
  mock.select.mockResolvedValue({
    projectId,
    referenceId: id,
    href: `/app/studio?project=${projectId}&reference=${id}`,
  });
  const response = await POST(request({ action: 'studio', projectId, id }));
  expect(response.status).toBe(200);
  expect(mock.select).toHaveBeenCalledWith(projectId, id);
});
