import { afterEach, expect, it, vi } from 'vitest';
import {
  uploadTalkImage,
  validateTalkImage,
  type UploadTicket,
} from '@/components/aurelius/talk-image-upload';
const ticket: UploadTicket = {
  id: 'reference',
  projectId: 'project',
  path: 'synthetic/original.png',
  token: 'synthetic-token',
  url: 'https://synthetic.test',
  publishableKey: 'synthetic-public',
};
const file = () => new File([new Uint8Array(128)], 'original.png', { type: 'image/png' });
afterEach(() => vi.unstubAllGlobals());
it('rejects unsupported files and sizes before any network request', () => {
  for (const f of [
    new File(['text'], 'file.pdf', { type: 'application/pdf' }),
    new File(['tiny'], 'image.png', { type: 'image/png' }),
    new File([new Uint8Array(10485761)], 'big.png', { type: 'image/png' }),
  ])
    expect(() => validateTalkImage(f)).toThrow(/PNG|JPEG|WebP/);
  expect(() =>
    validateTalkImage(new File([new Uint8Array(10485760)], 'limit.webp', { type: 'image/webp' })),
  ).not.toThrow();
});
it('transfers the exact original File and completes the same project/reference', async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce(Response.json(ticket))
    .mockResolvedValueOnce(Response.json({ id: ticket.id, projectId: ticket.projectId }));
  vi.stubGlobal('fetch', request);
  const transfer = vi.fn().mockResolvedValue(undefined);
  const original = file();
  const phases: string[] = [];
  const saved = await uploadTalkImage(
    original,
    {},
    () => true,
    (label) => phases.push(label),
    transfer,
  );
  expect(transfer).toHaveBeenCalledWith(ticket, original);
  expect(saved).toEqual({ id: ticket.id, projectId: ticket.projectId });
  expect(JSON.parse(request.mock.calls[1]![1].body)).toMatchObject({
    action: 'complete',
    id: ticket.id,
    projectId: ticket.projectId,
  });
  expect(phases).toEqual(['Preparing image…', 'Uploading image…', 'Verifying original image…']);
});
it('retry recovers uncertain completion without reupload, new IDs or asset deletion', async () => {
  const request = vi
    .fn()
    .mockResolvedValue(Response.json({ id: ticket.id, projectId: ticket.projectId }));
  vi.stubGlobal('fetch', request);
  const transfer = vi.fn();
  const saved = await uploadTalkImage(
    file(),
    { ticket },
    () => true,
    () => {},
    transfer,
  );
  expect(saved?.id).toBe(ticket.id);
  expect(transfer).not.toHaveBeenCalled();
  expect(request).toHaveBeenCalledTimes(1);
  expect(JSON.parse(request.mock.calls[0]![1].body).action).toBe('complete');
});
it('retry uploads the same ticket only when completion confirms a missing object', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(Response.json({ error: 'missing' }, { status: 409 }))
      .mockResolvedValueOnce(Response.json({ id: ticket.id, projectId: ticket.projectId })),
  );
  const transfer = vi.fn().mockResolvedValue(undefined);
  await uploadTalkImage(
    file(),
    { ticket },
    () => true,
    () => {},
    transfer,
  );
  expect(transfer).toHaveBeenCalledTimes(1);
});
it('an owner/session failure never falls through to upload', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(Response.json({ error: 'denied' }, { status: 403 })),
  );
  const transfer = vi.fn();
  await expect(
    uploadTalkImage(
      file(),
      { ticket },
      () => true,
      () => {},
      transfer,
    ),
  ).rejects.toMatchObject({ status: 403 });
  expect(transfer).not.toHaveBeenCalled();
});
for (const phase of ['prepare', 'transfer'])
  it(`cancellation or scope switch during ${phase} cannot attach or continue late`, async () => {
    let current = true;
    const request = vi.fn(async () => {
      if (phase === 'prepare') current = false;
      return Response.json(ticket);
    });
    vi.stubGlobal('fetch', request);
    const transfer = vi.fn(async () => {
      current = false;
    });
    const saved = await uploadTalkImage(
      file(),
      {},
      () => current,
      () => {},
      transfer,
    );
    expect(saved).toBeNull();
    expect(request).toHaveBeenCalledTimes(1);
    if (phase === 'prepare') expect(transfer).not.toHaveBeenCalled();
  });
