import { test, expect, type Page, type Route } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { initialProject } from '../../src/domains/architect-origin/schema';
import { originProjectIdentity, originSaveIdentity } from '../../src/domains/talk-creation/persist';

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

async function openArchitectMenu(page: Page) {
  await page.getByRole('button', { name: 'Aethelios menu', exact: true }).click();
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

async function dropResponseAfterCommit(
  page: Page,
  match: (payload: Record<string, unknown>) => boolean,
  verify: () => Promise<void>,
) {
  await page.route('**/api/aurelius/creations', async (route: Route) => {
    if (route.request().method() === 'POST') {
      const payload = route.request().postDataJSON() as Record<string, unknown>;
      if (match(payload)) {
        const response = await route.fetch();
        expect(response.ok()).toBeTruthy();
        await verify();
        return route.abort('failed');
      }
    }
    return route.continue();
  });
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
  const person = await owner
    .from('persons')
    .select('id')
    .eq('auth_user_id', (await owner.auth.getUser()).data.user!.id)
    .single();
  expect(person.error).toBeNull();
  const conversation = crypto.randomUUID();
  const turn = crypto.randomUUID();
  const briefId = crypto.randomUUID();
  const briefV2 = crypto.randomUUID();
  const candidateId = crypto.randomUUID();
  const handoffId = crypto.randomUUID();
  const importId = crypto.randomUUID();
  const wrongHandoffId = crypto.randomUUID();
  const wrongImportId = crypto.randomUUID();
  const occupiedBriefId = crypto.randomUUID();
  const expectedProject = originProjectIdentity(person.data!.id, handoffId);
  const expectedSave = originSaveIdentity(person.data!.id, handoffId);
  const wrongProject = originProjectIdentity(person.data!.id, wrongHandoffId);
  const wrongSave = originSaveIdentity(person.data!.id, wrongHandoffId);
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
  await page.goto('/app/work');
  await page.getByRole('link', { name: 'Open Architect ↗', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/architect/);
  const draftName = `Unsent Origin draft ${Date.now()}`;
  const savedVision = 'Keep this unsent Origin draft while Talk imports another package.';
  const unsentVision = 'Unsent Origin draft that must survive Talk import.';
  await page.getByLabel('Tell Aethelios what you want to create').fill(savedVision);
  await page.getByLabel('Project name (optional)').fill(draftName);
  await page.getByRole('button', { name: 'Create & save project' }).click();
  await expect(page.getByRole('status')).toContainText(/Saved revision 1|Saved/);
  await page.getByRole('button', { name: 'Blueprint', exact: true }).click();
  await page.getByLabel('Project vision').fill(unsentVision);
  await expect(page.getByLabel('Project vision')).toHaveValue(unsentVision);
  const draftUrl = page.url();

  page.once('dialog', (dialog) => dialog.dismiss());
  await openArchitectMenu(page);
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Talk' }).click();
  await expect(page).toHaveURL(draftUrl);
  await expect(page.getByLabel('Project vision')).toHaveValue(unsentVision);
  await page.keyboard.press('Escape');

  await page.goBack();
  await expect(page).toHaveURL(/\/app\/work/);
  await page.goForward();
  await expect(page).toHaveURL(draftUrl);
  await expect(page.getByLabel('Project vision')).toHaveValue(unsentVision);

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
  await dropResponseAfterCommit(
    page,
    (payload) => payload.id === lost && payload.kind === 'palette',
    async () => {
      const row = await owner.from('ai_talk_creations').select('id,version').eq('id', lost).maybeSingle();
      expect(row.data?.id).toBe(lost);
      expect(row.data?.version).toBe(1);
    },
  );
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

  const paletteRow = await owner.from('ai_talk_creations').select('id').eq('id', lost).maybeSingle();
  const extraBrief = await api<{ id: string }>(page, '/api/aurelius/creations', 'POST', {
    id: crypto.randomUUID(),
    conversationId: conversation,
    kind: 'brief',
    predecessorId: null,
    content: { ...brief, title: 'Other reserve brief' },
  });
  expect(extraBrief.status).toBe(201);
  expect(
    (
      await api(page, '/api/aurelius/creations', 'POST', {
        id: crypto.randomUUID(),
        conversationId: conversation,
        discipline: 'business',
        idea: 'A premium brand and website.',
        decisions: 'Keep emerald restrained.',
        creationIds: [briefV2, extraBrief.body.id],
        imageIds: [],
        preparedAt: '2026-10-14T00:00:00.000Z',
      })
    ).status,
  ).toBe(409);
  const prepared = await api<{ imported?: boolean; id: string }>(page, '/api/aurelius/creations', 'POST', {
    id: handoffId,
    conversationId: conversation,
    discipline: 'business',
    idea: 'A premium brand and website.',
    decisions: 'Keep emerald restrained.',
    creationIds: [briefV2, paletteRow.data?.id ?? lost],
    imageIds: [],
    preparedAt: '2026-10-14T00:00:00.000Z',
  });
  expect(prepared.status).toBe(201);
  expect(prepared.body.imported).toBe(false);
  const review = await api<{
    project?: Record<string, unknown> & { name: string; blueprint?: { deliverables?: string; state?: string } };
    originReady?: boolean;
    mappingVersion?: string;
    transfer?: {
      mappingVersion?: string;
      imagesCopied?: boolean;
      paletteRolesCopied?: boolean;
      copied?: unknown[];
      referenced?: Array<{ kind: string; versionId?: string }>;
    };
    images?: unknown[];
  }>(page, `/api/aurelius/creations?handoff=${handoffId}`);
  expect(review.status).toBe(200);
  expect(review.body.originReady).toBe(true);
  expect(review.body.mappingVersion).toBe('talk-origin-import/v1');
  expect(review.body.project?.name).toBeTruthy();
  expect(review.body.transfer?.mappingVersion).toBe('talk-origin-import/v1');
  expect(review.body.transfer?.imagesCopied).toBe(false);
  expect(review.body.transfer?.paletteRolesCopied).toBe(false);
  expect(review.body.project?.blueprint?.deliverables ?? '').not.toMatch(/background|accent/i);
  expect(review.body.project?.blueprint?.state).toMatch(/Referenced and retained in Talk only/);
  expect(review.body.transfer?.referenced?.some((item) => item.kind === 'brief' && item.versionId === briefV2)).toBe(
    true,
  );
  expect(review.body.transfer?.referenced?.some((item) => item.kind === 'palette' && item.versionId === lost)).toBe(
    true,
  );
  expect(review.body.images).toEqual([]);

  const occupiedBrief = await api<{ id: string }>(page, '/api/aurelius/creations', 'POST', {
    id: occupiedBriefId,
    conversationId: conversation,
    kind: 'brief',
    predecessorId: null,
    content: { ...brief, title: 'Occupied destination brief' },
  });
  expect(occupiedBrief.status).toBe(201);
  const wrongPrepared = await api<{ imported?: boolean }>(page, '/api/aurelius/creations', 'POST', {
    id: wrongHandoffId,
    conversationId: conversation,
    discipline: 'business',
    idea: 'A quieter luxury brand.',
    decisions: 'Keep emerald restrained.',
    creationIds: [occupiedBriefId],
    imageIds: [],
    preparedAt: '2026-10-14T00:00:00.000Z',
  });
  expect(wrongPrepared.status).toBe(201);
  expect(
    (
      await owner.rpc('architect_origin_save', {
        p_project: wrongProject,
        p_request: wrongSave,
        p_expected: 0,
        p_content: initialProject('Wrong valid content', 'business'),
        p_note: 'Imported from Talk',
      })
    ).data,
  ).toBe(1);
  expect(
    (
      await api(page, '/api/aurelius/creations', 'POST', {
        action: 'import-origin',
        id: wrongImportId,
        handoffId: wrongHandoffId,
        conversationId: conversation,
      })
    ).status,
  ).toBeGreaterThanOrEqual(400);
  const occupied = await owner
    .from('architect_origin_versions')
    .select('content,note')
    .eq('id', wrongSave)
    .maybeSingle();
  expect(occupied.data?.note).toBe('Imported from Talk');
  expect((occupied.data?.content as { name?: string } | null)?.name).toBe('Wrong valid content');
  expect((await owner.from('ai_talk_origin_imports').select('id').eq('handoff_id', wrongHandoffId)).data).toEqual(
    [],
  );
  expect((await owner.rpc('ai_talk_scoped_identity', { p_seed: `talk-origin-project:${person.data!.id}:${handoffId}` })).error).toBeTruthy();
  expect(
    (
      await owner.rpc('ai_talk_record_origin_import', {
        p_id: crypto.randomUUID(),
        p_handoff: handoffId,
        p_project: expectedProject,
        p_save: expectedSave,
        p_conversation: conversation,
        p_prepared: '2026-10-14T00:00:00.000Z',
      })
    ).error,
  ).toBeTruthy();

  await dropResponseAfterCommit(
    page,
    (payload) => payload.action === 'import-origin' && payload.id === importId,
    async () => {
      const receipt = await owner
        .from('ai_talk_origin_imports')
        .select('id,project_id,save_id')
        .eq('id', importId)
        .maybeSingle();
      expect(receipt.data).toMatchObject({
        id: importId,
        project_id: expectedProject,
        save_id: expectedSave,
      });
      const version = await owner
        .from('architect_origin_versions')
        .select('id,revision,note,content')
        .eq('id', expectedSave)
        .maybeSingle();
      expect(version.data).toMatchObject({
        id: expectedSave,
        revision: 1,
        note: 'Imported from Talk',
      });
      expect(version.data?.content).toEqual(review.body.project);
      expect((version.data?.content as { name?: string } | null)?.name).toBe(review.body.project?.name);
      expect((version.data?.content as { blueprint?: { state?: string } } | null)?.blueprint?.state).toBe(
        review.body.project?.blueprint?.state,
      );
    },
  );
  const lostImport = await api<{ imported?: boolean }>(page, '/api/aurelius/creations', 'POST', {
    action: 'import-origin',
    id: importId,
    handoffId,
    conversationId: conversation,
  });
  expect(lostImport.body.imported).not.toBe(true);
  await page.unroute('**/api/aurelius/creations');
  const [one, two] = await Promise.all([
    api<{
      projectId?: string;
      imported?: boolean;
      saveId?: string;
      project?: Record<string, unknown>;
    }>(page, '/api/aurelius/creations', 'POST', {
      action: 'import-origin',
      id: importId,
      handoffId,
      conversationId: conversation,
    }),
    api<{
      projectId?: string;
      imported?: boolean;
      saveId?: string;
      project?: Record<string, unknown>;
    }>(page, '/api/aurelius/creations', 'POST', {
      action: 'import-origin',
      id: crypto.randomUUID(),
      handoffId,
      conversationId: conversation,
    }),
  ]);
  expect(one.status).toBe(201);
  expect(two.status).toBe(201);
  expect(one.body.imported).toBe(true);
  expect(two.body.imported).toBe(true);
  expect(two.body.projectId).toBe(one.body.projectId);
  expect(one.body.project).toEqual(review.body.project);
  expect(two.body.project).toEqual(review.body.project);
  expect(one.body.projectId).toBe(expectedProject);
  expect(one.body.saveId).toBe(expectedSave);
  expect((await owner.from('ai_talk_origin_imports').select('id').eq('handoff_id', handoffId)).data?.length).toBe(1);
  expect(
    (
      await api(page, '/api/aurelius/creations', 'POST', {
        action: 'import-origin',
        id: importId,
        handoffId: crypto.randomUUID(),
        conversationId: conversation,
      })
    ).status,
  ).toBeGreaterThanOrEqual(400);
  expect(
    (
      await api(page, '/api/aurelius/creations', 'POST', {
        action: 'import-origin',
        id: importId,
        handoffId,
        conversationId: crypto.randomUUID(),
      })
    ).status,
  ).toBeGreaterThanOrEqual(400);
  const opened = await api<{
    projects?: Array<{ id: string; content?: { blueprint?: { state?: string; vision?: string } } }>;
  }>(page, `/api/architect-origin?project=${one.body.projectId}`);
  expect(opened.status).toBe(200);
  expect(opened.body.projects?.some((item) => item.id === one.body.projectId)).toBe(true);
  const importedProject = opened.body.projects?.find((item) => item.id === one.body.projectId);
  expect(importedProject?.content?.blueprint?.vision).not.toBe(unsentVision);
  expect(importedProject?.content?.blueprint?.state).toMatch(/Referenced and retained in Talk only/);

  await expect(page).toHaveURL(draftUrl);
  await expect(page.getByLabel('Project vision')).toHaveValue(unsentVision);

  const other = await browser.newContext();
  const foreignPage = await other.newPage();
  await signIn(foreignPage, 'member@aurelius.test');
  expect((await api(foreignPage, `/api/aurelius/creations?handoff=${handoffId}`)).status).toBeGreaterThanOrEqual(400);
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
  expect((await api(foreignPage, `/api/architect-origin?project=${one.body.projectId}`)).status).toBeGreaterThanOrEqual(
    400,
  );
  await other.close();

  page.once('dialog', (dialog) => dialog.accept());
  await openArchitectMenu(page);
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Talk' }).click();
  await expect(page).toHaveURL(/\/app\/aethelios/);
  await page.goBack();
  await expect(page).toHaveURL(draftUrl);
  await expect(page.getByLabel('Project vision')).toHaveValue(savedVision);

  await page.goto(`/app/aethelios?conversation=${conversation}`);
  const refinedBrief = page.getByRole('heading', { name: 'Reserve site refined', exact: true });
  await expect(refinedBrief.first()).toBeVisible();
  let releaseHeldGet: (() => void) | undefined;
  const heldGet = new Promise<void>((resolve) => {
    releaseHeldGet = resolve;
  });
  let resolveSawHeldGet: (() => void) | undefined;
  const sawHeldGet = new Promise<void>((resolve) => {
    resolveSawHeldGet = resolve;
  });
  let holding = false;
  await page.route(`**/api/aurelius/creations?conversationId=${conversation}`, async (route) => {
    const url = new URL(route.request().url());
    if (
      !holding &&
      route.request().method() === 'GET' &&
      url.searchParams.get('conversationId') === conversation
    ) {
      holding = true;
      resolveSawHeldGet?.();
      await heldGet;
    }
    return route.continue();
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sawHeldGet;
  await expect(page.getByRole('heading', { name: 'Aethelios' })).toBeVisible();
  await page.getByRole('button', { name: 'New', exact: true }).click();
  releaseHeldGet?.();
  await expect(refinedBrief).toHaveCount(0);
  await page.unroute(`**/api/aurelius/creations?conversationId=${conversation}`);
  await page.goto(`/app/aethelios?conversation=${conversation}`);
  await expect(refinedBrief.first()).toBeVisible();
  await expect(page.getByText('Proposal · not applied')).toBeVisible();
  await expect(page.getByText('Saved in Architect.')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/app/aethelios?conversation=${conversation}`);
  await expect(page.getByText('Saved in Architect.')).toBeVisible();
  await page.setViewportSize({ width: 720, height: 900 });
  await expect(page.getByText('Saved in Architect.')).toBeVisible();
  await owner.from('ai_conversations').delete().eq('id', conversation);
});
