import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { designBoardContentSchema } from '../../src/domains/talk-creation/design-board';
import {
  produceArchitectDirection,
  directionProjectIdentity,
} from '../../src/domains/talk-creation/architect-direction';
import {
  designDirectionDigest,
  type DesignDirectionReceipt,
} from '../../src/domains/architect-design-direction/contract';

const env = Object.fromEntries(
  readFileSync('.env.development.local', 'utf8')
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const at = line.indexOf('=');
      return [line.slice(0, at), line.slice(at + 1)];
    }),
);
if (new URL(env.NEXT_PUBLIC_SUPABASE_URL!).hostname !== '127.0.0.1')
  throw new Error('Disposable loopback Supabase required');
const password = env.AURELIUS_FOUNDER_PASSWORD!;
const user = () =>
  createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
async function signIn(page: Page, email: string) {
  await page.goto('/enter');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Enter Aethelios', exact: true }).click();
  await expect(page).toHaveURL(/\/app(?:\/|$|\?)/);
}
async function api<T>(page: Page, path: string, method = 'GET', body?: unknown) {
  return page.evaluate(
    async ({ path, method, body }) => {
      const response = await fetch(path, {
        method,
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store',
      });
      return { status: response.status, body: (await response.json()) as T };
    },
    { path, method, body },
  );
}
type BoardRow = {
  id: string;
  version: number;
  lineage_id: string;
  superseded_by: string | null;
  source_turn_id: string | null;
  content: unknown;
};

test('real premium saved revision transfers with exact durable authority, original artifacts and revocation guards', async ({
  page,
  browser,
}, info) => {
  const owner = user();
  expect(
    (await owner.auth.signInWithPassword({ email: 'founder@aurelius.test', password })).error,
  ).toBeNull();
  await signIn(page, 'founder@aurelius.test');
  await page.goto('/app/aethelios');
  const composer = page.getByLabel('Message Aethelios', { exact: true });
  await composer.fill('Give me three visual directions for Aethelios Lifestyle.');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('tab', { name: /The Founder’s Journal/ })).toBeVisible({
    timeout: 60000,
  });
  await expect(page.locator('.im-response[data-phase="complete"]').last()).toBeVisible();
  const conversationId = new URL(page.url()).searchParams.get('conversation')!;
  expect(conversationId).toMatch(/^[0-9a-f-]{36}$/);
  const rows = async () => {
    const response = await api<{ creations: BoardRow[] }>(
      page,
      `/api/aurelius/creations?conversationId=${conversationId}`,
    );
    expect(response.status).toBe(200);
    return response.body.creations.filter((row) => row.lineage_id);
  };
  const first = (await rows()).find((row) => !row.superseded_by)!;
  expect(first.version).toBe(1);
  await page.getByRole('tab', { name: /A Singular Standard/ }).click();
  await expect.poll(async () => (await rows()).find((row) => !row.superseded_by)?.version).toBe(2);
  await expect(
    page.locator('.talk-creation-card[data-kind="board"]').getByText(/Design board · v2/),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'Open', exact: true }).first().click();
  let panel = page.getByRole('complementary', { name: 'Reviewed work' });
  await panel.getByText('Edit colors & design details', { exact: true }).click();
  const headline = 'A singular, considered future.';
  await panel.getByLabel('Campaign headline', { exact: true }).fill(headline);
  await panel.getByLabel('Restrained gold swatch', { exact: true }).fill('#d8bc78');
  await panel.getByRole('button', { name: 'Save this version', exact: true }).click();
  await expect.poll(async () => (await rows()).find((row) => !row.superseded_by)?.version).toBe(3);
  await expect(
    page.locator('.talk-creation-card[data-kind="board"]').getByText(/Design board · v3/),
  ).toBeVisible();
  const current = (await rows()).find((row) => !row.superseded_by)!;
  const board = designBoardContentSchema.parse(current.content);
  expect(board.selectedDirectionId).toBe('direction-c');
  expect(board.directions[2]!.demo.headline).toBe(headline);
  expect(board.directions[0]).toEqual(designBoardContentSchema.parse(first.content).directions[0]);
  const history = await owner
    .from('ai_talk_creations')
    .select('id,version,source_turn_id,superseded_by')
    .eq('lineage_id', first.lineage_id)
    .order('version');
  expect(history.error).toBeNull();
  expect(history.data).toHaveLength(3);
  expect(history.data?.every((row) => row.source_turn_id === first.source_turn_id)).toBe(true);
  expect(first.source_turn_id).toBeTruthy();
  await page.reload();
  await expect(page.getByRole('heading', { name: headline, level: 4 })).toBeVisible();
  await page.getByRole('button', { name: 'Open', exact: true }).first().click();
  for (const [name, width, height] of [
    ['desktop', 1440, 900],
    ['phone', 390, 844],
    ['fold', 884, 690],
  ] as const) {
    await page.setViewportSize({ width, height });
    panel = page.getByRole(width < 900 ? 'dialog' : 'complementary', { name: 'Reviewed work' });
    await expect(panel.getByRole('heading', { name: headline, level: 4 })).toBeVisible();
    expect(await panel.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    await page.screenshot({
      path: info.outputPath(`premium-talk-${name}.png`),
      animations: 'disabled',
    });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  panel = page.getByRole('complementary', { name: 'Reviewed work' });
  const reviewed = await api<{ digest: string; receipt: DesignDirectionReceipt }>(
    page,
    `/api/aurelius/creations?direction=${current.id}`,
  );
  expect(reviewed.status).toBe(200);
  const expected = produceArchitectDirection({
    conversationId,
    boardId: current.id,
    version: 3,
    board,
  });
  expect(reviewed.body.receipt).toEqual(expected);
  expect(reviewed.body.digest).toBe(expected.digest);
  const source = await owner.rpc('ai_talk_review_premium_direction', {
    p_conversation: conversationId,
    p_board: current.id,
    p_version: 3,
  });
  expect(source.error).toBeNull();
  expect(source.data).toEqual({ capability: 'talk-premium-receipt/v1', receipt: expected });
  await panel.getByRole('button', { name: 'Review design transfer', exact: true }).click();
  await expect(panel.getByText(/Exact composition, typefaces, material/)).toBeVisible();
  await panel.getByRole('button', { name: 'Confirm transfer', exact: true }).click();
  await expect(
    panel.getByText('Received in Architect. Build approval is still required.', { exact: true }),
  ).toBeVisible();
  const link = panel.getByRole('link', { name: 'Open in Architect', exact: true });
  const projectId = new URL(
    (await link.getAttribute('href'))!,
    'http://127.0.0.1',
  ).searchParams.get('project')!;
  const durable = await owner
    .from('architect_design_directions')
    .select('*')
    .eq('project_id', projectId)
    .single();
  expect(durable.error).toBeNull();
  expect(durable.data).toMatchObject({
    receipt: expected,
    digest: expected.digest,
    verified: true,
    source_kind: 'talk-authorized',
    started: false,
  });
  const requestId = durable.data!.request_id;
  const transfer = {
    action: 'transfer-direction',
    id: requestId,
    conversationId,
    boardId: current.id,
    reviewedDigest: expected.digest,
  };
  expect((await api(page, '/api/aurelius/creations', 'POST', transfer)).status).toBe(201);
  expect(
    (
      await owner
        .from('architect_design_directions')
        .select('request_id')
        .eq('project_id', projectId)
    ).data,
  ).toHaveLength(1);
  expect(
    (await owner.from('ai_talk_direction_transfers').select('id').eq('id', requestId)).data,
  ).toHaveLength(1);
  expect(
    (
      await api(page, '/api/aurelius/creations', 'POST', {
        ...transfer,
        reviewedDigest: '0'.repeat(64),
      })
    ).status,
  ).toBe(409);
  const tampered = structuredClone(expected);
  tampered.content.designSnapshot!.direction.tokens.material = 'stone';
  tampered.digest = designDirectionDigest(tampered.content, tampered.sourceRecords);
  expect(
    (
      await api(page, '/api/architect-design-direction', 'POST', {
        action: 'receive',
        requestId: crypto.randomUUID(),
        projectId,
        receipt: tampered,
      })
    ).status,
  ).toBeGreaterThanOrEqual(400);
  const forged = await owner.rpc('architect_apps_retain_design', {
    p_request: crypto.randomUUID(),
    p_project: projectId,
    p_digest: tampered.digest,
    p_receipt: tampered,
    p_source_kind: 'talk-authorized',
    p_verified: true,
  });
  expect(forged.error).toBeTruthy();
  await link.click();
  const retained = page.getByRole('region', { name: 'Retained creative direction' });
  await expect(retained.getByRole('heading', { name: headline, level: 4 })).toBeVisible();
  for (const [name, width, height] of [
    ['desktop', 1440, 900],
    ['phone', 390, 844],
    ['fold', 884, 690],
  ] as const) {
    await page.setViewportSize({ width, height });
    await expect(retained).toBeVisible();
    await retained.getByRole('heading', { name: headline, level: 4 }).scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({
      path: info.outputPath(`premium-architect-${name}.png`),
      animations: 'disabled',
    });
  }
  await page.reload();
  await expect(retained.getByRole('heading', { name: headline, level: 4 })).toBeVisible();
  const reloaded = await api<{
    direction: {
      receipt: DesignDirectionReceipt;
      digest: string;
      verified: boolean;
      source_kind: string;
    };
  }>(page, `/api/architect-design-direction?project=${projectId}`);
  expect(reloaded.status).toBe(200);
  expect(reloaded.body.direction.receipt).toEqual(expected);
  expect(reloaded.body.direction.receipt.content.designSnapshot).toEqual(
    expected.content.designSnapshot,
  );
  expect(reloaded.body.direction.receipt.identity).toEqual(expected.identity);
  // A new saved source creates a separate identity. A retain-only interrupted
  // handoff recovers its existing request on review instead of duplicating it.
  const updatedBoard = structuredClone(board);
  updatedBoard.directions[2]!.demo.headline = 'A separate next revision.';
  updatedBoard.directions[2]!.copy.headline = 'A separate next revision.';
  const updatedId = crypto.randomUUID();
  expect(
    (
      await api(page, '/api/aurelius/creations', 'POST', {
        id: updatedId,
        conversationId,
        sourceTurnId: current.source_turn_id,
        kind: 'board',
        predecessorId: current.id,
        content: updatedBoard,
      })
    ).status,
  ).toBe(201);
  const updated = produceArchitectDirection({
    conversationId,
    boardId: updatedId,
    version: 4,
    board: updatedBoard,
  });
  const updatedProject = directionProjectIdentity(
    durable.data!.person_id,
    updatedId,
    4,
    'direction-c',
  );
  const updatedRequest = crypto.randomUUID();
  expect(
    (
      await api(page, '/api/architect-design-direction', 'POST', {
        action: 'receive',
        requestId: updatedRequest,
        projectId: updatedProject,
        receipt: updated,
      })
    ).status,
  ).toBe(200);
  const recovered = await api<{ requestId: string; imported: boolean; destinationValid: boolean }>(
    page,
    `/api/aurelius/creations?direction=${updatedId}`,
  );
  expect(recovered.body).toMatchObject({
    requestId: updatedRequest,
    imported: false,
    destinationValid: true,
  });
  expect(
    (
      await api(page, '/api/aurelius/creations', 'POST', {
        action: 'transfer-direction',
        id: recovered.body.requestId,
        conversationId,
        boardId: updatedId,
        reviewedDigest: updated.digest,
      })
    ).status,
  ).toBe(201);
  expect(
    (
      await api(page, '/api/architect-design-direction', 'POST', {
        action: 'receive',
        requestId: crypto.randomUUID(),
        projectId: updatedProject,
        receipt: updated,
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await api<{ direction: { receipt: DesignDirectionReceipt } }>(
        page,
        `/api/architect-design-direction?project=${projectId}`,
      )
    ).body.direction.receipt,
  ).toEqual(expected);
  expect(
    (
      await owner
        .from('architect_design_directions')
        .select('request_id')
        .eq('project_id', updatedProject)
    ).data,
  ).toHaveLength(1);
  await retained.getByRole('button', { name: 'Review build brief', exact: true }).click();
  expect(
    (await owner.from('architect_app_jobs').select('id').eq('project_id', projectId)).data,
  ).toHaveLength(0);
  expect(
    (await owner.from('architect_app_jobs').select('id').eq('project_id', updatedProject)).data,
  ).toHaveLength(0);
  const other = await browser.newContext();
  const foreignPage = await other.newPage();
  await signIn(foreignPage, 'member@aurelius.test');
  expect(
    (await api(foreignPage, '/api/aurelius/creations', 'POST', transfer)).status,
  ).toBeGreaterThanOrEqual(400);
  expect(
    (
      await api(foreignPage, '/api/architect-design-direction', 'POST', {
        action: 'receive',
        requestId: crypto.randomUUID(),
        projectId,
        receipt: expected,
      })
    ).status,
  ).toBeGreaterThanOrEqual(400);
  await other.close();
  // Preserve the existing no-direct-table-write permission boundary.
  expect(
    (
      await owner
        .from('ai_conversations')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', conversationId)
    ).error?.code,
  ).toBe('42501');
  expect(
    (await api(page, '/api/aurelius', 'PATCH', { id: conversationId, title: null, archived: true }))
      .status,
  ).toBe(200);
  expect((await api(page, `/api/architect-design-direction?project=${projectId}`)).status).toBe(
    409,
  );
  expect(
    (
      await owner
        .from('architect_design_directions')
        .select('receipt')
        .eq('request_id', requestId)
        .single()
    ).data?.receipt,
  ).toEqual(expected);
  expect(
    (
      await api(page, '/api/aurelius', 'PATCH', {
        id: conversationId,
        title: null,
        archived: false,
      })
    ).status,
  ).toBe(200);
  expect((await api(page, `/api/architect-design-direction?project=${projectId}`)).status).toBe(
    200,
  );
  writeFileSync(
    info.outputPath('premium-auth-receipt.json'),
    JSON.stringify(
      {
        schema: 'premium-handoff-acceptance/v1',
        mode: 'Disposable real Supabase Auth/PostgREST; deterministic model fixture; no execution',
        source: expected.identity,
        digest: expected.digest,
        projectId,
        requestId,
        receipt: expected,
        history: history.data,
        subsequentVersion: {
          identity: updated.identity,
          digest: updated.digest,
          projectId: updatedProject,
          requestId: updatedRequest,
        },
      },
      null,
      2,
    ),
  );
});
