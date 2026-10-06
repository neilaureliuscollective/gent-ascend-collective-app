import { test, expect, type Page } from './fixtures';
import type { WorkspaceData, Turn } from '../../src/domains/intelligence/types';
import {
  councilPromptVersion,
  type CouncilSelection,
} from '../../src/domains/intelligence/council';
async function setup(page: Page, configured = true) {
  const state: WorkspaceData = {
    conversations: [],
    turns: [],
    memories: [],
    actionProposals: [],
    context: {
      profile: {
        name: 'Synthetic Member',
        priority: 'Choose deliberately',
        timezone: 'UTC',
        units: 'metric',
        updatedAt: '2026-10-04',
      },
      goal: null,
      memories: [],
    },
    canChat: true,
    configured,
    model: 'synthetic-model',
  };
  const sent: Array<{
    text: string;
    includeContext: boolean;
    council?: CouncilSelection;
    requestId: string;
    conversationId: string;
  }> = [];
  await page.route('**/api/aurelius**', async (route) => {
    const req = route.request();
    if (new URL(req.url()).pathname.endsWith('/chat')) {
      const body = req.postDataJSON();
      sent.push(body);
      const turn: Turn = {
        id: body.requestId,
        person_id: 'synthetic-member',
        conversation_id: body.conversationId,
        user_text: body.text,
        assistant_text:
          body.council?.kind === 'table'
            ? '### Athena\nOptions and tradeoffs.\n\n### Themis\nVerify the assumptions.\n\n### Aethelios synthesis\nA considered next step.'
            : 'A focused, useful answer.',
        status: 'complete',
        model: state.model,
        context_included: body.includeContext,
        prompt_version: body.council ? councilPromptVersion(body.council) : 'normal-prompt',
        feedback: null,
        created_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
      };
      state.turns.push(turn);
      if (!state.conversations.some((c) => c.id === turn.conversation_id))
        state.conversations.push({
          id: turn.conversation_id,
          person_id: 'synthetic-member',
          title: body.text,
          created_at: turn.created_at,
          updated_at: turn.created_at,
        });
      return route.fulfill({
        contentType: 'application/x-ndjson',
        body:
          JSON.stringify({ type: 'delta', text: turn.assistant_text }) +
          '\n' +
          JSON.stringify({ type: 'saved', turn }) +
          '\n',
      });
    }
    const id = new URL(req.url()).searchParams.get('conversationId');
    return route.fulfill({
      json: {
        ...state,
        turns: id ? state.turns.filter((t) => t.conversation_id === id) : [],
        currentConversation: state.conversations.find((c) => c.id === id) ?? null,
      },
    });
  });
  await page.goto('/app/aethelios');
  await expect(page.getByRole('heading', { name: 'What’s on your mind?' })).toBeVisible();
  return { state, sent };
}
test('specialist recommendation and manual access remain deliberate and restore saved identity', async ({
  page,
}) => {
  const { sent } = await setup(page);
  await page.getByLabel('Message Aethelios').fill('Compare my career options');
  await page.getByRole('button', { name: 'Tools & context', exact: true }).click();
  await expect(page.getByText('Relevant Council · Athena · Themis')).toBeVisible();
  if (!(await page.getByRole('button', { name: 'Close Tools & context', exact: true }).isVisible()))
    await page.getByRole('button', { name: 'Tools & context', exact: true }).click();
  await page.getByRole('button', { name: 'The Council', exact: true }).click();
  await page.getByRole('button', { name: 'Involve Athena', exact: true }).click();
  expect(sent).toHaveLength(0);
  if (await page.getByRole('button', { name: 'Close Tools & context', exact: true }).isVisible())
    await page.getByRole('button', { name: 'Close Tools & context', exact: true }).click();
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Reply saved.');
  expect(sent[0]?.council).toEqual({ kind: 'specialist', specialists: ['athena'] });
  await expect(page.locator('.message-author').last()).toHaveText('Athena');
  await page.reload();
  await page.getByRole('button', { name: 'Tools & context', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Return to Aethelios' })).toBeVisible();
  await page.getByRole('button', { name: 'Return to Aethelios' }).click();
  await page.getByRole('button', { name: 'Close Tools & context', exact: true }).click();
  await page.getByLabel('Message Aethelios').fill('Keep it simple');
  if (await page.getByRole('button', { name: 'Close Tools & context', exact: true }).isVisible())
    await page.getByRole('button', { name: 'Close Tools & context', exact: true }).click();
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Reply saved.');
  expect(sent[1]?.council).toBeUndefined();
});
test('Table reviews exact objective and cast, uses context opt-out, synthesizes, exits and keeps history', async ({
  page,
}) => {
  const { sent } = await setup(page);
  await page.getByLabel('Message Aethelios').fill('Compare two opportunities');
  await page.getByRole('button', { name: 'Tools & context', exact: true }).click();
  await page.getByLabel('Use personal context').uncheck();
  await page.getByRole('button', { name: 'Assemble Around This' }).click();
  const dialog = page.locator('.council-dialog');
  await expect(dialog.getByText('Personal context is off.', { exact: false })).toBeVisible();
  expect(sent).toHaveLength(0);
  await dialog.getByLabel('What are we examining?').fill('Compare two career opportunities');
  await dialog.getByRole('button', { name: 'Confirm and assemble' }).click();
  await page.getByRole('button', { name: 'Close Tools & context', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Reply saved.');
  expect(sent[0]).toMatchObject({
    text: 'Compare two career opportunities',
    includeContext: false,
    council: { kind: 'table', specialists: ['athena', 'themis'] },
  });
  await expect(page.getByRole('heading', { name: 'Aethelios synthesis' })).toBeVisible();
  await page.getByLabel('Message Aethelios').fill('What is the risk?');
  await page
    .locator('.aurelius-composer')
    .getByRole('button', { name: 'Review The Table' })
    .click();
  await expect(dialog).toBeVisible();
  expect(sent).toHaveLength(1);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Tools & context', exact: true }).click();
  await page.getByRole('button', { name: 'Leave The Table' }).click();
  await page.getByRole('button', { name: 'Close Tools & context', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeEnabled();
  await expect(page.getByRole('heading', { name: 'Aethelios synthesis' })).toBeVisible();
});
test('new specialist conversation shares existing architecture without reusing another thread', async ({
  page,
}) => {
  const { sent } = await setup(page);
  await page.getByLabel('Message Aethelios').fill('A first question');
  if (await page.getByRole('button', { name: 'Close Tools & context', exact: true }).isVisible())
    await page.getByRole('button', { name: 'Close Tools & context', exact: true }).click();
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Reply saved.');
  if (!(await page.getByRole('button', { name: 'Close Tools & context', exact: true }).isVisible()))
    await page.getByRole('button', { name: 'Tools & context', exact: true }).click();
  await page.getByRole('button', { name: 'The Council', exact: true }).click();
  await page
    .locator('.council-dialog')
    .locator('article')
    .filter({ hasText: 'Apollo' })
    .getByRole('button', { name: 'Open focused conversation' })
    .click();
  await page.getByRole('button', { name: 'Close Tools & context', exact: true }).click();
  await page.getByLabel('Message Aethelios').fill('Refine this writing');
  if (await page.getByRole('button', { name: 'Close Tools & context', exact: true }).isVisible())
    await page.getByRole('button', { name: 'Close Tools & context', exact: true }).click();
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Reply saved.');
  expect(sent[1]?.conversationId).not.toEqual(sent[0]?.conversationId);
  expect(sent[1]?.council).toEqual({ kind: 'specialist', specialists: ['apollo'] });
});
for (const width of [360, 720, 1024, 1920])
  test(`Council and Table at ${width}px with reduced motion`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await setup(page);
    await page.getByLabel('Message Aethelios').fill('Plan a strategy');
    if (
      !(await page.getByRole('button', { name: 'Close Tools & context', exact: true }).isVisible())
    )
      await page.getByRole('button', { name: 'Tools & context', exact: true }).click();
    await page.getByRole('button', { name: 'The Council', exact: true }).click();
    const dialog = page.locator('.council-dialog');
    await expect(dialog.getByRole('heading', { name: 'The Council', exact: true })).toBeVisible();
    expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    const bounds = await dialog.boundingBox();
    expect(Math.abs(bounds!.x + bounds!.width / 2 - width / 2)).toBeLessThan(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/council-${width}.png` });
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'The Council', exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'Assemble Around This' }).click();
    await expect(dialog.getByRole('heading', { name: 'The Table', exact: true })).toBeVisible();
    expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: `test-results/table-${width}.png` });
    expect(errors).toEqual([]);
  });
test('unavailable model blocks Council execution without breaking chat workspace', async ({
  page,
}) => {
  const { sent } = await setup(page, false);
  await page.getByRole('button', { name: 'Tools & context', exact: true }).click();
  await expect(page.getByRole('button', { name: 'The Council', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Memory', exact: true }).click();
  await expect(page.getByLabel('What should Aethelios remember?')).toBeVisible();
  expect(sent).toHaveLength(0);
});
