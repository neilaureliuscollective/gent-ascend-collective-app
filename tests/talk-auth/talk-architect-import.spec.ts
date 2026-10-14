import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

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
const brief = {
  title: 'Reserve site',
  purpose: 'A premium brand and website.',
  audience: 'Founders',
  visualDirection: 'Obsidian and gold',
  requirements: ['Phone first'],
  unresolved: ['Typeface'],
};
const palette = {
  title: 'Imperial palette',
  notes: 'Exact hex roles.',
  swatches: [
    { hex: '#080D0D', name: 'Obsidian', role: 'background' },
    { hex: '#C4912F', name: 'Reserve Gold', role: 'accent' },
  ],
  contrast: [],
};

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
  await expect(page).toHaveURL(/\/app\//);
}

async function api<T>(page: Page, path: string, method = 'GET', body?: unknown) {
  return page.evaluate(
    async ({ path: url, method: verb, body: payload }) => {
      try {
        const response = await fetch(url, {
          method: verb,
          headers: payload ? { 'content-type': 'application/json' } : undefined,
          body: payload ? JSON.stringify(payload) : undefined,
          cache: 'no-store',
        });
        return { status: response.status, body: (await response.json()) as T };
      } catch {
        return { status: 0, body: {} as T };
      }
    },
    { path, method, body },
  );
}

test('authenticated Talk recovery and Architect import through real routes', async ({
  page,
  browser,
}) => {
  const owner = user();
  const foreign = user();
  expect(
    (await owner.auth.signInWithPassword({ email: 'founder@aurelius.test', password })).error,
  ).toBeNull();
  expect(
    (await foreign.auth.signInWithPassword({ email: 'member@aurelius.test', password })).error,
  ).toBeNull();
  const conversation = crypto.randomUUID();
  const turn = crypto.randomUUID();
  const briefId = crypto.randomUUID();
  const briefV2 = crypto.randomUUID();
  const candidateId = crypto.randomUUID();
  const handoffId = crypto.randomUUID();
  const importId = crypto.randomUUID();
  expect(
    (
      await owner.rpc('ai_begin_turn', {
        p_conversation: conversation,
        p_request: turn,
        p_text: 'Synthetic Talk Architect acceptance',
        p_model: 'synthetic-no-model-call',
        p_context: false,
        p_prompt_version: 'talk-architect-import',
      })
    ).error,
  ).toBeNull();

  await signIn(page, 'founder@aurelius.test');
  await page.goto('/app/architect');
  const draftName = `Unsent Origin draft ${Date.now()}`;
  await page.getByLabel('Tell Aethelios what you want to create').fill(
    'Keep this unsent Origin draft while Talk imports another package.',
  );
  await page.getByLabel('Project name (optional)').fill(draftName);
  await page.getByRole('button', { name: 'Create & save project' }).click();
  await expect(page.getByRole('status')).toContainText(/Saved revision 1|Saved/);
  const draftUrl = page.url();
  await page.getByRole('button', { name: 'Blueprint', exact: true }).click();
  await page.getByLabel('Project vision').fill('Unsent Origin draft that must survive Talk import.');
  await expect(page.getByLabel('Project vision')).toHaveValue(
    'Unsent Origin draft that must survive Talk import.',
  );

  await page.goto(`/app/aethelios?conversation=${conversation}`);
  const saved = await api<{ id: string }>(page, '/api/aurelius/creations', 'POST', {
    id: briefId,
    conversationId: conversation,
    sourceTurnId: turn,
    kind: 'brief',
    predecessorId: null,
    content: brief,
  });
  expect(saved.status).toBe(201);
  const refined = await api<{ version?: number }>(page, '/api/aurelius/creations', 'POST', {
    id: briefV2,
    conversationId: conversation,
    kind: 'brief',
    predecessorId: briefId,
    content: { ...brief, title: 'Reserve site refined', purpose: 'A quieter luxury brand.' },
  });
  expect(refined.status).toBe(201);
  expect(
    (
      await api<{ creations?: Array<{ id: string; version: number }> }>(
        page,
        `/api/aurelius/creations?conversationId=${conversation}`,
      )
    ).body.creations?.some((item) => item.id === briefV2 && item.version === 2),
  ).toBe(true);
  const lost = crypto.randomUUID();
  await page.route('**/api/aurelius/creations', async (route) => {
    if (route.request().method() === 'POST') {
      const payload = route.request().postDataJSON() as { id?: string };
      if (payload.id === lost) return route.abort();
    }
    return route.continue();
  });
  const firstTry = await api<{ error?: string }>(page, '/api/aurelius/creations', 'POST', {
    id: lost,
    conversationId: conversation,
    kind: 'palette',
    predecessorId: null,
    content: palette,
  });
  expect(firstTry.status).not.toBe(201);
  await page.unroute('**/api/aurelius/creations');
  const retry = await api<{ id: string }>(page, '/api/aurelius/creations', 'POST', {
    id: lost,
    conversationId: conversation,
    kind: 'palette',
    predecessorId: null,
    content: palette,
  });
  expect(retry.status).toBe(201);
  expect(retry.body.id).toBe(lost);
  expect(
    (
      await owner.rpc('ai_talk_save_candidate', {
        p_id: candidateId,
        p_conversation: conversation,
        p_turn: turn,
        p_kind: 'brief',
        p_base: briefV2,
        p_content: { ...brief, title: 'Stale generated proposal' },
      })
    ).error,
  ).toBeNull();
  expect(
    (
      await owner
        .from('ai_talk_selection')
        .select('creation_id')
        .eq('conversation_id', conversation)
        .eq('kind', 'brief')
        .single()
    ).data?.creation_id,
  ).toBe(briefV2);

  let delayed = true;
  await page.route(`**/api/aurelius/creations?conversationId=${conversation}`, async (route) => {
    if (delayed && route.request().method() === 'GET') {
      delayed = false;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    return route.continue();
  });
  const reloading = page.reload();
  await expect(page.getByRole('heading', { name: 'Aethelios' })).toBeVisible();
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await reloading;
  await expect(page.getByText('Reserve site refined')).toHaveCount(0);
  await page.unroute(`**/api/aurelius/creations?conversationId=${conversation}`);
  await page.goto(`/app/aethelios?conversation=${conversation}`);
  await expect(page.getByText('Reserve site refined')).toBeVisible();
  await expect(page.getByText('Proposal · not applied')).toBeVisible();

  const paletteRow = await owner
    .from('ai_talk_creations')
    .select('id')
    .eq('id', lost)
    .maybeSingle();
  const prepared = await api<{ imported?: boolean; id: string }>(
    page,
    '/api/aurelius/creations',
    'POST',
    {
      id: handoffId,
      conversationId: conversation,
      discipline: 'business',
      idea: 'A premium brand and website.',
      decisions: 'Keep emerald restrained.',
      creationIds: [briefV2, paletteRow.data?.id ?? lost],
      imageIds: [],
      preparedAt: '2026-10-14T00:00:00.000Z',
    },
  );
  expect(prepared.status).toBe(201);
  expect(prepared.body.imported).toBe(false);
  const review = await api<{ project?: { name: string }; originReady?: boolean }>(
    page,
    `/api/aurelius/creations?handoff=${handoffId}`,
  );
  expect(review.status).toBe(200);
  expect(review.body.originReady).toBe(true);
  expect(review.body.project?.name).toBeTruthy();

  await page.route('**/api/aurelius/creations', async (route) => {
    if (route.request().method() === 'POST') {
      const payload = route.request().postDataJSON() as { action?: string; id?: string };
      if (payload.action === 'import-origin' && payload.id === importId) return route.abort();
    }
    return route.continue();
  });
  const lostImport = await api<{ imported?: boolean }>(page, '/api/aurelius/creations', 'POST', {
    action: 'import-origin',
    id: importId,
    handoffId,
    conversationId: conversation,
  });
  expect(lostImport.body.imported).not.toBe(true);
  await page.unroute('**/api/aurelius/creations');
  const [one, two] = await Promise.all([
    api<{ projectId?: string; imported?: boolean }>(page, '/api/aurelius/creations', 'POST', {
      action: 'import-origin',
      id: importId,
      handoffId,
      conversationId: conversation,
    }),
    api<{ projectId?: string; imported?: boolean }>(page, '/api/aurelius/creations', 'POST', {
      action: 'import-origin',
      id: crypto.randomUUID(),
      handoffId,
      conversationId: conversation,
    }),
  ]);
  expect(one.status).toBe(201);
  expect(two.status).toBe(201);
  expect(one.body.imported).toBe(true);
  expect(two.body.projectId).toBe(one.body.projectId);
  const opened = await api<{ projects?: Array<{ id: string }> }>(
    page,
    `/api/architect-origin?project=${one.body.projectId}`,
  );
  expect(opened.status).toBe(200);
  expect(opened.body.projects?.some((item) => item.id === one.body.projectId)).toBe(true);

  const other = await browser.newContext();
  const foreignPage = await other.newPage();
  await signIn(foreignPage, 'member@aurelius.test');
  expect((await api(foreignPage, `/api/aurelius/creations?handoff=${handoffId}`)).status).toBeGreaterThanOrEqual(
    400,
  );
  expect(
    (
      await api(foreignPage, '/api/aurelius/creations', 'POST', {
        action: 'import-origin',
        id: crypto.randomUUID(),
        handoffId,
        conversationId: conversation,
      })
    ).status,
  ).toBeGreaterThanOrEqual(400);
  expect(
    (await api(foreignPage, `/api/architect-origin?project=${one.body.projectId}`)).status,
  ).toBeGreaterThanOrEqual(400);
  await other.close();

  await page.goto(draftUrl);
  await expect(page.getByLabel('Project vision')).toHaveValue(
    'Unsent Origin draft that must survive Talk import.',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/app/aethelios?conversation=${conversation}`);
  await expect(page.getByText('Saved in Architect.')).toBeVisible();
  await page.setViewportSize({ width: 720, height: 900 });
  await expect(page.getByText('Saved in Architect.')).toBeVisible();
  await owner.from('ai_conversations').delete().eq('id', conversation);
});
