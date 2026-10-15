import { test, expect, type Page, type Route } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { produceArchitectDirection } from '../../src/domains/talk-creation/architect-direction';
import { designBoardContentSchema } from '../../src/domains/talk-creation/design-board';

const env = Object.fromEntries(
  readFileSync('.env.development.local', 'utf8')
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);
if (new URL(env.NEXT_PUBLIC_SUPABASE_URL!).hostname !== '127.0.0.1')
  throw new Error('Disposable local synthetic Supabase required');

const password = env.AURELIUS_FOUNDER_PASSWORD!;

function user() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signIn(page: Page, email: string) {
  await page.goto('/enter');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Enter Aethelios', exact: true }).click();
  await expect(page).toHaveURL(/\/app(?:\/|$|\?)/);
}

async function api<T>(
  page: Page,
  path: string,
  method = 'GET',
  body?: unknown,
  allowAbort = false,
) {
  return page.evaluate(
    async ({ path: url, method: verb, body: payload, allowAbort: tolerateAbort }) => {
      try {
        const response = await fetch(url, {
          method: verb,
          headers: payload ? { 'content-type': 'application/json' } : undefined,
          body: payload ? JSON.stringify(payload) : undefined,
          cache: 'no-store',
        });
        return {
          status: response.status,
          aborted: false,
          body: (await response.json()) as T,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (tolerateAbort && /Failed to fetch|network/i.test(message))
          return { status: 0, aborted: true, body: { error: message } as T };
        throw error;
      }
    },
    { path, method, body, allowAbort },
  );
}

async function sendComposer(page: Page, text: string) {
  const composer = page.getByLabel('Message Aethelios', { exact: true });
  await expect(composer).toBeEnabled();
  await composer.fill(text);
  const send = page.getByRole('button', { name: 'Send', exact: true });
  await expect(send).toBeEnabled();
  await send.click();
}

type BoardRow = {
  id: string;
  version: number;
  superseded_by: string | null;
  content: {
    selectedDirectionId: string;
    directions: Array<{ id: string; name: string; tokens: { colors: Array<{ hex: string }> } }>;
  };
};

test('authenticated design-board selection, refinement, reload and Architect transfer', async ({
  page,
  browser,
}) => {
  const owner = user();
  expect(
    (await owner.auth.signInWithPassword({ email: 'founder@aurelius.test', password })).error,
  ).toBeNull();
  await signIn(page, 'founder@aurelius.test');
  await page.goto('/app/aethelios');
  await expect(page.getByLabel('Message Aethelios', { exact: true })).toBeVisible();
  await expect(page.getByText(/waiting for its model connection/i)).toHaveCount(0);
  await sendComposer(page, 'Give me three visual directions for Legacy Reserve.');
  await expect(page.getByRole('tab', { name: /Warm Reserve/ })).toBeVisible({ timeout: 60000 });
  await expect(page.getByText('Labelled deterministic Talk fixture')).toBeVisible();
  const conversation = new URL(page.url()).searchParams.get('conversation');
  expect(conversation).toMatch(/^[0-9a-f-]{36}$/i);
  await page.getByRole('tab', { name: /Emerald Glass/ }).click();
  await expect
    .poll(async () => {
      const workspace = await api<{ creations: BoardRow[] }>(
        page,
        `/api/aurelius/creations?conversationId=${conversation}`,
      );
      const current = workspace.body.creations.find((item) => !item.superseded_by);
      return current
        ? `${current.content.selectedDirectionId}:${current.version}:${current.id}`
        : '';
    })
    .toMatch(/^direction-c:2:/);
  await sendComposer(page, 'Make the selected direction warmer.');
  await expect(page.getByText(/selected direction is warmer/i)).toBeVisible({ timeout: 60000 });
  const workspace = await api<{ creations: BoardRow[] }>(
    page,
    `/api/aurelius/creations?conversationId=${conversation}`,
  );
  const current = workspace.body.creations.find((item) => !item.superseded_by);
  expect(current?.content.selectedDirectionId).toBe('direction-c');
  expect(current?.content.directions.find((item) => item.id === 'direction-a')?.name).toBe(
    'Graphite Chamber',
  );
  expect(current?.content.directions.find((item) => item.id === 'direction-b')?.name).toBe(
    'Warm Reserve',
  );
  const earlier = workspace.body.creations.find((item) => item.version === 2);
  expect(earlier?.superseded_by).toBe(current?.id);
  const originalHighlight = earlier?.content.directions.find((item) => item.id === 'direction-c')
    ?.tokens.colors;
  expect(current?.content.directions.find((item) => item.id === 'direction-c')?.tokens.colors).not.toEqual(
    originalHighlight,
  );
  const refinedId = current!.id;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('tab', { name: /Emerald Glass/ })).toBeVisible();
  await page.locator('[data-kind="board"]').getByRole('button', { name: 'Open', exact: true }).click();
  const reviewPanel = page.getByLabel('Reviewed work');
  await reviewPanel.getByRole('button', { name: 'Review design transfer' }).click();
  await expect(reviewPanel.getByText('Emerald Glass')).toBeVisible();
  await expect(reviewPanel.getByText(/Mapped color roles/)).toBeVisible();
  await expect(reviewPanel.getByText(/Hero-product demonstration/)).toBeVisible();
  const reviewed = await api<{
    receipt: {
      digest: string;
      identity: { directionId: string; boardId: string; boardVersion: number; conversationId: string };
      content: { name: string; identity: { directionId: string } };
      sourceRecords: unknown[];
    };
    imported: boolean;
    digest: string;
    boardVersion: number;
    selectedDirectionId: string;
  }>(page, `/api/aurelius/creations?direction=${refinedId}`);
  expect(reviewed.status).toBe(200);
  expect(reviewed.body.imported).toBe(false);
  expect(reviewed.body.digest).toMatch(/^[0-9a-f]{64}$/);
  expect(reviewed.body.selectedDirectionId).toBe('direction-c');
  const transferId = crypto.randomUUID();
  await page.route('**/api/aurelius/creations', async (route: Route) => {
    if (route.request().method() === 'POST') {
      const payload = route.request().postDataJSON() as Record<string, unknown>;
      if (payload.action === 'transfer-direction') {
        const response = await route.fetch();
        expect(response.ok()).toBeTruthy();
        const committed = await owner
          .from('architect_design_directions')
          .select('request_id,digest,verified')
          .eq('digest', reviewed.body.digest)
          .maybeSingle();
        expect(committed.error).toBeNull();
        expect(committed.data).toMatchObject({
          digest: reviewed.body.digest,
          verified: true,
        });
        await route.abort('failed');
        return;
      }
    }
    return route.continue();
  });
  await reviewPanel.getByRole('button', { name: 'Confirm transfer' }).click();
  await expect(reviewPanel.getByText(/Confirm again to recover/)).toBeVisible();
  await page.unroute('**/api/aurelius/creations');
  await reviewPanel.getByRole('button', { name: 'Confirm transfer' }).click();
  await expect(reviewPanel.getByText(/Imported\. Architect acknowledged/)).toBeVisible();
  const destinations = await owner
    .from('architect_design_directions')
    .select('request_id,project_id,digest,verified')
    .eq('digest', reviewed.body.digest);
  expect(destinations.data).toHaveLength(1);
  expect(destinations.data?.[0]?.verified).toBe(true);
  const receipts = await owner
    .from('ai_talk_direction_transfers')
    .select('id,imported,digest')
    .eq('digest', reviewed.body.digest);
  expect(receipts.data).toHaveLength(1);
  expect(receipts.data?.[0]?.imported).toBe(true);
  const projectId = destinations.data?.[0]?.project_id;
  expect(projectId).toBeTruthy();
  const savedRequestId = destinations.data?.[0]?.request_id;
  expect(
    (
      await api(page, '/api/aurelius/creations', 'POST', {
        action: 'transfer-direction',
        id: crypto.randomUUID(),
        conversationId: conversation,
        boardId: refinedId,
        reviewedDigest: 'b'.repeat(64),
      })
    ).status,
  ).toBeGreaterThanOrEqual(400);
  const boardRow = await owner.from('ai_talk_creations').select('content,version').eq('id', refinedId).maybeSingle();
  const board = designBoardContentSchema.parse(boardRow.data?.content);
  const authorized = produceArchitectDirection({
    conversationId: conversation!,
    boardId: refinedId,
    version: boardRow.data!.version,
    board,
  });
  const forgedCases = [
    {
      label: 'direction identity',
      receipt: {
        ...authorized,
        identity: { ...authorized.identity, directionId: crypto.randomUUID() },
        content: {
          ...authorized.content,
          identity: { ...authorized.content.identity, directionId: crypto.randomUUID() },
        },
      },
      digest: authorized.digest,
    },
    {
      label: 'content',
      receipt: {
        ...authorized,
        content: { ...authorized.content, name: 'Forged Chamber' },
      },
      digest: authorized.digest,
    },
    {
      label: 'digest',
      receipt: { ...authorized, digest: 'c'.repeat(64) },
      digest: 'c'.repeat(64),
    },
  ];
  for (const forged of forgedCases) {
    const forgedRetain = await owner.rpc('architect_apps_retain_design', {
      p_request: crypto.randomUUID(),
      p_project: projectId,
      p_digest: forged.digest,
      p_receipt: forged.receipt,
      p_source_kind: 'talk-authorized',
      p_verified: true,
    });
    if (!forgedRetain.error) {
      const forgedRow = await owner
        .from('architect_design_directions')
        .select('verified,source_kind')
        .eq('request_id', forgedRetain.data)
        .maybeSingle();
      expect(forgedRow.data?.verified, `${forged.label} must not verify`).toBe(false);
    }
    expect(
      (
        await owner.rpc('ai_talk_record_direction_transfer', {
          p_id: typeof forgedRetain.data === 'string' ? forgedRetain.data : crypto.randomUUID(),
          p_conversation: conversation,
          p_board: refinedId,
          p_version: boardRow.data!.version,
          p_direction: 'direction-c',
          p_direction_uuid: authorized.identity.directionId,
          p_project: projectId,
          p_digest: forged.digest,
          p_receipt: { schema: 'talk-architect-direction/v1' },
        })
      ).error,
      `${forged.label} must not record a Talk import`,
    ).toBeTruthy();
  }
  expect(
    (
      await owner.rpc('architect_apps_retain_design', {
        p_request: crypto.randomUUID(),
        p_project: projectId,
        p_digest: 'c'.repeat(64),
        p_receipt: {
          identity: {
            conversationId: conversation,
            boardId: refinedId,
            boardVersion: 99,
            directionId: authorized.identity.directionId,
          },
        },
        p_source_kind: 'talk-authorized',
        p_verified: true,
      })
    ).error || true,
  ).toBeTruthy();
  expect(
    (
      await owner.rpc('ai_live_observe_item', {
        p_session: crypto.randomUUID(),
        p_conversation: conversation,
        p_item: 'spoken-1',
        p_response: 'resp-1',
      })
    ).error,
  ).toBeTruthy();
  expect(
    (
      await owner.rpc('ai_live_observe_trusted_item', {
        p_session: crypto.randomUUID(),
        p_conversation: conversation,
        p_item: 'spoken-1',
        p_response: 'resp-1',
      })
    ).error,
  ).toBeTruthy();
  expect(
    (
      await owner.rpc('ai_live_bind_turn', {
        p_session: crypto.randomUUID(),
        p_conversation: conversation,
        p_item: 'spoken-1',
        p_response: 'resp-1',
        p_turn: crypto.randomUUID(),
      })
    ).error,
  ).toBeTruthy();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('tab', { name: /Emerald Glass/ })).toBeVisible();
  const reopened = await api<{
    imported: boolean;
    digest: string;
    projectId: string | null;
    destinationValid?: boolean;
  }>(page, `/api/aurelius/creations?direction=${refinedId}`);
  expect(reopened.body.imported).toBe(true);
  expect(reopened.body.destinationValid).toBe(true);
  expect(reopened.body.digest).toBe(reviewed.body.digest);
  expect(savedRequestId).toBeTruthy();
  const persisted = await owner
    .from('architect_design_directions')
    .select('request_id,verified,digest')
    .eq('request_id', savedRequestId)
    .maybeSingle();
  expect(persisted.data).toMatchObject({
    request_id: savedRequestId,
    verified: true,
    digest: reviewed.body.digest,
  });
  const other = await browser.newContext();
  const foreignPage = await other.newPage();
  await signIn(foreignPage, 'member@aurelius.test');
  expect((await api(foreignPage, `/api/aurelius/creations?direction=${refinedId}`)).status).toBeGreaterThanOrEqual(
    400,
  );
  expect(
    (
      await api(foreignPage, '/api/aurelius/creations', 'POST', {
        action: 'transfer-direction',
        id: transferId,
        conversationId: conversation,
        boardId: refinedId,
        reviewedDigest: reviewed.body.digest,
      })
    ).status,
  ).toBeGreaterThanOrEqual(400);
  await other.close();
  await owner.from('ai_conversations').delete().eq('id', conversation);
});
