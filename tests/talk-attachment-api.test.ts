import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mock = vi.hoisted(() => ({ prepare: vi.fn(), complete: vi.fn(), select: vi.fn() }));
vi.mock('@/domains/talk-creation/service', () => ({
  prepareTalkAttachment: mock.prepare,
  completeTalkAttachment: mock.complete,
}));
vi.mock('@/domains/studio/reference-selection', () => ({ selectStudioReference: mock.select }));
import { POST } from '@/app/api/aurelius/attachments/route';
function request(body: unknown) {
  return new Request('https://app.test/api/aurelius/attachments', {
    method: 'POST',
    headers: { origin: 'https://app.test', host: 'app.test', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
beforeEach(() => vi.clearAllMocks());
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
