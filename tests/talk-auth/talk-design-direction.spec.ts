import { test, expect, type Page, type Route } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { legacyReserveBoard, selectDesignDirection } from '../../src/domains/talk-creation/design-board';
import { refineSelectedDirection } from '../../src/domains/talk-creation/design-board';

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

test('authenticated design-board selection, refinement, reload and Architect transfer', async ({
  page,
  browser,
}) => {
  const owner = user();
  expect(
    (await owner.auth.signInWithPassword({ email: 'founder@aurelius.test', password })).error,
  ).toBeNull();
  const conversation = crypto.randomUUID();
  const turn = crypto.randomUUID();
  expect(
    (
      await owner.rpc('ai_begin_turn', {
        p_conversation: conversation,
        p_request: turn,
        p_text: 'Give me three visual directions for Legacy Reserve.',
        p_model: 'synthetic-no-model-call',
        p_context: false,
        p_prompt_version: 'talk-design-direction',
      })
    ).error,
  ).toBeNull();
  await signIn(page, 'founder@aurelius.test');
  const firstBoard = crypto.randomUUID();
  const created = await api<{ id: string }>(page, '/api/aurelius/creations', 'POST', {
    id: firstBoard,
    conversationId: conversation,
    sourceTurnId: turn,
    kind: 'board',
    predecessorId: null,
    content: legacyReserveBoard(),
  });
  expect(created.status).toBe(201);
  await page.goto(`/app/aethelios?conversation=${conversation}`);
  await expect(page.getByRole('tab', { name: /Warm Reserve/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('tab', { name: /Emerald Glass/ }).click();
  await expect
    .poll(async () => {
      const workspace = await api<{
        creations: Array<{
          id: string;
          version: number;
          superseded_by: string | null;
          content: { selectedDirectionId: string };
        }>;
      }>(page, `/api/aurelius/creations?conversationId=${conversation}`);
      const current = workspace.body.creations.find((item) => !item.superseded_by);
      return current
        ? `${current.content.selectedDirectionId}:${current.version}:${current.id}`
        : '';
    })
    .toMatch(/^direction-c:2:/);
  const selectedWorkspace = await api<{
    creations: Array<{
      id: string;
      superseded_by: string | null;
      content: { selectedDirectionId: string; directions: Array<{ id: string; name: string }> };
    }>;
  }>(page, `/api/aurelius/creations?conversationId=${conversation}`);
  const selectedBoard = selectedWorkspace.body.creations.find((item) => !item.superseded_by);
  expect(selectedBoard?.content.selectedDirectionId).toBe('direction-c');
  const refinedId = crypto.randomUUID();
  const refined = refineSelectedDirection(
    selectDesignDirection(legacyReserveBoard(), 'direction-c'),
    { warmer: true },
  );
  const saved = await api<{ id: string; version: number }>(page, '/api/aurelius/creations', 'POST', {
    id: refinedId,
    conversationId: conversation,
    sourceTurnId: turn,
    kind: 'board',
    predecessorId: selectedBoard?.id,
    content: refined,
  });
  expect(saved.status).toBe(201);
  const workspace = await api<{
    creations: Array<{
      id: string;
      version: number;
      content: {
        selectedDirectionId: string;
        directions: Array<{ id: string; name: string; tokens: { colors: Array<{ hex: string }> } }>;
      };
    }>;
  }>(page, `/api/aurelius/creations?conversationId=${conversation}`);
  const current = workspace.body.creations.find((item) => item.id === refinedId);
  expect(current?.content.selectedDirectionId).toBe('direction-c');
  expect(current?.content.directions.find((item) => item.id === 'direction-a')?.name).toBe(
    'Graphite Chamber',
  );
  expect(current?.content.directions.find((item) => item.id === 'direction-b')?.name).toBe(
    'Warm Reserve',
  );
  const originalC = selectDesignDirection(legacyReserveBoard(), 'direction-c').directions.find(
    (item) => item.id === 'direction-c',
  );
  expect(current?.content.directions.find((item) => item.id === 'direction-c')?.tokens.colors).not.toEqual(
    originalC?.tokens.colors,
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('tab', { name: /Emerald Glass/ })).toBeVisible();
  const reviewed = await api<{
    receipt: { digest: string; identity: { directionId: string } };
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
  const transferBody = {
    action: 'transfer-direction' as const,
    id: transferId,
    conversationId: conversation,
    boardId: refinedId,
    reviewedDigest: reviewed.body.digest,
  };
  await page.route('**/api/aurelius/creations', async (route: Route) => {
    if (route.request().method() === 'POST') {
      const payload = route.request().postDataJSON() as Record<string, unknown>;
      if (payload.action === 'transfer-direction' && payload.id === transferId) {
        const response = await route.fetch();
        expect(response.ok()).toBeTruthy();
        const committed = await owner
          .from('architect_design_directions')
          .select('request_id,digest,verified')
          .eq('request_id', transferId)
          .maybeSingle();
        expect(committed.error).toBeNull();
        expect(committed.data).toMatchObject({
          request_id: transferId,
          digest: reviewed.body.digest,
          verified: true,
        });
        await route.abort('failed');
        return;
      }
    }
    return route.continue();
  });
  const lost = await api(page, '/api/aurelius/creations', 'POST', transferBody, true);
  expect(lost.aborted).toBe(true);
  expect(lost.status).toBe(0);
  await page.unroute('**/api/aurelius/creations');
  const retry = await api<{ imported: boolean; projectId: string; digest: string; recovered?: boolean }>(
    page,
    '/api/aurelius/creations',
    'POST',
    transferBody,
  );
  expect(retry.status).toBe(201);
  expect(retry.body.imported).toBe(true);
  expect(retry.body.digest).toBe(reviewed.body.digest);
  const destinations = await owner
    .from('architect_design_directions')
    .select('request_id,project_id,digest')
    .eq('request_id', transferId);
  expect(destinations.data).toHaveLength(1);
  expect(destinations.data?.[0]?.digest).toBe(reviewed.body.digest);
  const receipts = await owner.from('ai_talk_direction_transfers').select('id,imported').eq('id', transferId);
  expect(receipts.data).toHaveLength(1);
  expect(receipts.data?.[0]?.imported).toBe(true);
  const again = await api<{ imported: boolean; projectId: string; recovered?: boolean }>(
    page,
    '/api/aurelius/creations',
    'POST',
    transferBody,
  );
  expect(again.body.projectId).toBe(retry.body.projectId);
  expect(again.body.recovered).toBe(true);
  expect(
    (
      await api(page, '/api/aurelius/creations', 'POST', {
        ...transferBody,
        reviewedDigest: 'b'.repeat(64),
      })
    ).status,
  ).toBeGreaterThanOrEqual(400);
  expect(
    (
      await owner.from('ai_talk_direction_transfers').insert({
        id: crypto.randomUUID(),
        person_id: (await owner.auth.getUser()).data.user?.id,
        conversation_id: conversation,
        board_id: refinedId,
        board_version: 3,
        direction_id: 'direction-c',
        direction_uuid: reviewed.body.receipt.identity.directionId,
        project_id: retry.body.projectId,
        digest: reviewed.body.digest,
        receipt: { schema: 'talk-architect-direction/v1' },
        imported: true,
      })
    ).error,
  ).toBeTruthy();
  expect(
    (
      await owner.rpc('ai_talk_record_direction_transfer', {
        p_id: crypto.randomUUID(),
        p_conversation: conversation,
        p_board: refinedId,
        p_version: 3,
        p_direction: 'direction-c',
        p_direction_uuid: reviewed.body.receipt.identity.directionId,
        p_project: crypto.randomUUID(),
        p_digest: reviewed.body.digest,
        p_receipt: { schema: 'talk-architect-direction/v1' },
      })
    ).error,
  ).toBeTruthy();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('tab', { name: /Emerald Glass/ })).toBeVisible();
  const reopened = await api<{ imported: boolean; digest: string; projectId: string | null }>(
    page,
    `/api/aurelius/creations?direction=${refinedId}`,
  );
  expect(reopened.body.imported).toBe(true);
  expect(reopened.body.digest).toBe(reviewed.body.digest);
  const other = await browser.newContext();
  const foreignPage = await other.newPage();
  await signIn(foreignPage, 'member@aurelius.test');
  expect((await api(foreignPage, `/api/aurelius/creations?direction=${refinedId}`)).status).toBeGreaterThanOrEqual(
    400,
  );
  expect(
    (
      await api(foreignPage, '/api/aurelius/creations', 'POST', {
        ...transferBody,
        id: crypto.randomUUID(),
      })
    ).status,
  ).toBeGreaterThanOrEqual(400);
  await other.close();
  await owner.from('ai_conversations').delete().eq('id', conversation);
});
