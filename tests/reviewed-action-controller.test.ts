import { afterEach, expect, it, vi } from 'vitest';
import { LiveController } from '@/domains/live/controller';
import { reviewedAction, type ReviewedActionPreparation } from '@/domains/artifacts/daily-action';
const conversationId = 'ad000000-0000-4000-8000-000000000001',
  reviewId = 'ad000000-0000-4000-8000-000000000002';
const preparation: ReviewedActionPreparation = {
  conversationId,
  reviewId,
  sourceTitle: 'Synthetic scoped review',
  day: '2026-10-12',
  timezone: 'UTC',
  version: 4,
  receipt: null,
};
afterEach(() => vi.unstubAllGlobals());
it('requires explicit confirmation and rejects provider approval, account IDs and arbitrary commands', () => {
  const input = {
    id: crypto.randomUUID(),
    conversationId,
    reviewId,
    title: 'Verify sources',
    day: preparation.day,
    version: 4,
    timezone: 'UTC',
    confirm: true,
  };
  expect(reviewedAction.safeParse(input).success).toBe(true);
  for (const changed of [
    { confirm: false },
    { personId: crypto.randomUUID() },
    { acknowledgeCost: true },
    { command: 'execute' },
    { title: '' },
  ])
    expect(reviewedAction.safeParse({ ...input, ...changed }).success).toBe(false);
});
it('prepares no automatic title/write, preserves an edited action across mode changes and verifies exact receipts', async () => {
  const requests: { method?: string; body?: string }[] = [];
  const fetch = vi.fn(async (_: string, init?: RequestInit) => {
    requests.push({ method: init?.method, body: init?.body as string });
    if (init?.method === 'POST') {
      const body = JSON.parse(init.body as string);
      return Response.json({
        ...preparation,
        receipt: { id: body.id, title: body.title, day: body.day, verified: true },
      });
    }
    return Response.json(preparation);
  });
  vi.stubGlobal('fetch', fetch);
  const controller = new LiveController();
  controller.bindConversation(conversationId);
  await controller.prepareDailyAction(reviewId);
  expect(controller.getSnapshot().reviewedAction?.title).toBe('');
  expect(requests.every((request) => request.method !== 'POST')).toBe(true);
  controller.editDailyAction('  Verify the source before using it  ');
  controller.mode('compact');
  expect(controller.getSnapshot().reviewedAction?.title).toContain('Verify the source');
  await Promise.all([controller.confirmDailyAction(), controller.confirmDailyAction()]);
  expect(requests.filter((request) => request.method === 'POST')).toHaveLength(1);
  expect(controller.getSnapshot().reviewedAction?.receipt).toMatchObject({
    title: 'Verify the source before using it',
    verified: true,
  });
  expect(controller.getSnapshot().phase).toBe('idle');
});
it('locks an uncertain write, never retries it and recovers only by reading the persisted receipt', async () => {
  let sent: Record<string, string> | null = null,
    reads = 0;
  const fetch = vi.fn(async (_: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      sent = JSON.parse(init.body as string);
      throw new Error('Synthetic connection lost');
    }
    reads++;
    return Response.json({
      ...preparation,
      receipt:
        reads > 2 ? { id: sent!.id, title: sent!.title, day: sent!.day, verified: true } : null,
    });
  });
  vi.stubGlobal('fetch', fetch);
  const controller = new LiveController();
  controller.bindConversation(conversationId);
  await controller.prepareDailyAction(reviewId);
  controller.editDailyAction('My chosen action');
  await controller.confirmDailyAction();
  expect(controller.getSnapshot().reviewedAction?.phase).toBe('uncertain');
  controller.closeDailyAction();
  controller.editDailyAction('Changed');
  await controller.confirmDailyAction();
  await controller.prepareDailyAction(reviewId);
  expect(controller.getSnapshot().reviewedAction?.title).toBe('My chosen action');
  await controller.checkDailyAction();
  expect(controller.getSnapshot().reviewedAction?.phase).toBe('uncertain');
  await controller.checkDailyAction();
  expect(controller.getSnapshot().reviewedAction?.phase).toBe('receipt');
  expect(fetch.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
});
it('does not accept a mismatched success receipt or a late response from another conversation', async () => {
  let complete: (response: Response) => void = () => {};
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? new Promise<Response>((resolve) => {
            complete = resolve;
          })
        : Response.json(preparation),
    ),
  );
  const controller = new LiveController();
  controller.bindConversation(conversationId);
  await controller.prepareDailyAction(reviewId);
  controller.editDailyAction('Choose my action');
  const save = controller.confirmDailyAction();
  complete(
    Response.json({
      ...preparation,
      receipt: {
        id: crypto.randomUUID(),
        title: 'Something else',
        day: preparation.day,
        verified: true,
      },
    }),
  );
  await save;
  expect(controller.getSnapshot().reviewedAction?.phase).toBe('uncertain');
  controller.bindConversation(crypto.randomUUID());
  expect(controller.getSnapshot().reviewedAction).toBeNull();
  controller.dispose();
});
it('a preparation/status read arriving during confirmation cannot unlock or replace it', async () => {
  let finishRead: (response: Response) => void = () => {},
    finishWrite: (response: Response) => void = () => {};
  let reads = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_: string, init?: RequestInit) => {
      if (init?.method === 'POST')
        return new Promise<Response>((resolve) => {
          finishWrite = resolve;
        });
      if (++reads === 1) return Response.json(preparation);
      return new Promise<Response>((resolve) => {
        finishRead = resolve;
      });
    }),
  );
  const controller = new LiveController();
  controller.bindConversation(conversationId);
  await controller.prepareDailyAction(reviewId);
  controller.editDailyAction('Exact chosen title');
  const status = controller.checkDailyAction();
  const write = controller.confirmDailyAction();
  finishRead(Response.json(preparation));
  await status;
  expect(controller.getSnapshot().reviewedAction?.phase).toBe('saving');
  controller.bindConversation(crypto.randomUUID());
  finishWrite(Response.json(preparation));
  await write;
  expect(controller.getSnapshot().reviewedAction).toBeNull();
});
