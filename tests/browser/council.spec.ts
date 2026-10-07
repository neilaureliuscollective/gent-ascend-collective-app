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
  await expect(
    page.getByRole('heading', { name: 'What would you like to move forward?' }),
  ).toBeVisible();
  return { state, sent };
}

test('team is visible, explains routing, involves a specialist and restores saved identity', async ({
  page,
}) => {
  const { sent } = await setup(page);
  await page.getByLabel('Message Aethelios').fill('Pressure-test this business idea');
  await expect(page.getByRole('button', { name: 'Meet the Intelligence Team' })).toBeVisible();
  await page.getByRole('button', { name: 'Meet the Intelligence Team' }).click();
  const dialog = page.locator('.council-dialog:not(.mission-editor)');
  await expect(dialog.getByText(/Relevant here/)).toContainText('pressure-test');
  await dialog.getByRole('button', { name: 'Involve Athena', exact: true }).click();
  expect(sent).toHaveLength(0);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.locator('.aurelius-notice')).toContainText('Reply saved.');
  expect(sent[0]?.council).toEqual({ kind: 'specialist', specialists: ['athena'] });
  expect(sent[0]?.includeContext).toBe(false);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Return to Aethelios' })).toBeVisible();
  await page.getByRole('button', { name: 'Return to Aethelios' }).click();
  await page.getByLabel('Message Aethelios').fill('Keep it simple');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.locator('.aurelius-notice')).toContainText('Reply saved.');
  expect(sent[1]?.council).toBeUndefined();
});
test('Table reviews objective and cast, synthesizes with context off, and persists', async ({
  page,
}) => {
  const { sent } = await setup(page);
  await page.getByLabel('Message Aethelios').fill('Compare two opportunities');
  await page.getByRole('button', { name: 'Assemble Around This' }).click();
  const dialog = page.locator('.council-dialog:not(.mission-editor)');
  await expect(dialog.getByText(/Personal context is off/)).toBeVisible();
  expect(sent).toHaveLength(0);
  await dialog.getByLabel('What are we examining?').fill('Compare two career opportunities');
  await dialog.getByRole('button', { name: 'Confirm and assemble' }).click();
  await expect(page.locator('.aurelius-notice')).toContainText('Reply saved.');
  expect(sent[0]).toMatchObject({
    includeContext: false,
    council: { kind: 'table', specialists: ['athena', 'themis'] },
  });
  await expect(page.getByText('A considered next step.')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Leave The Table' })).toBeVisible();
});
test('focused conversation prepares a useful starter without sending or inheriting another thread', async ({
  page,
}) => {
  const { sent } = await setup(page);
  await page.getByLabel('Message Aethelios').fill('Research a decision');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.locator('.aurelius-notice')).toContainText('Reply saved.');
  await page.getByRole('button', { name: 'Meet the Intelligence Team' }).click();
  await page
    .locator('.council-roster article')
    .filter({ hasText: 'Apollo' })
    .getByRole('button', { name: 'Open focused conversation' })
    .click();
  await expect(page.getByLabel('Message Aethelios')).toHaveValue(/creative direction/);
  expect(sent).toHaveLength(1);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.locator('.aurelius-notice')).toContainText('Reply saved.');
  expect(sent[1]?.conversationId).not.toEqual(sent[0]?.conversationId);
  expect(sent[1]?.council).toEqual({ kind: 'specialist', specialists: ['apollo'] });
});
for (const width of [360, 720, 1024, 1920])
  test(`Team and Table at ${width}px with reduced motion`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await setup(page);
    await page.getByLabel('Message Aethelios').fill('Plan a strategy');
    await page.getByRole('button', { name: 'Meet the Intelligence Team' }).click();
    const dialog = page.locator('.council-dialog:not(.mission-editor)');
    await expect(dialog.getByRole('heading', { name: 'Your Intelligence Team' })).toBeVisible();
    expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/team-${width}.png` });
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Meet the Intelligence Team' })).toBeFocused();
    await page.getByRole('button', { name: 'Assemble Around This' }).click();
    await expect(dialog.getByRole('heading', { name: 'The Table', exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
test('model outage still permits team discovery but blocks provider work', async ({ page }) => {
  const { sent } = await setup(page, false);
  await page.getByRole('button', { name: 'Meet the Intelligence Team' }).click();
  await expect(page.getByRole('button', { name: 'Involve Athena' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Tools & context', exact: true }).click();
  await page.getByRole('button', { name: 'Memory', exact: true }).click();
  await expect(page.getByLabel('What should Aethelios remember?')).toBeVisible();
  expect(sent).toHaveLength(0);
});
test('first useful outcome becomes a reviewed private Mission without a second AI call', async ({
  page,
}) => {
  const { sent } = await setup(page);
  let saved: unknown;
  await page.route('**/api/missions', (route) => {
    saved = route.request().postDataJSON();
    return route.fulfill({ json: { mission: saved } });
  });
  await page.getByLabel('Message Aethelios').fill('Launch my landscaping website');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.locator('.aurelius-notice')).toContainText('Reply saved.');
  await page.getByRole('button', { name: 'Save as Mission' }).click();
  await page.getByLabel('Mission name').fill('Landscaping website');
  await page.getByLabel('Next action (optional)').fill('Review homepage brief');
  await page.getByRole('button', { name: 'Create Mission', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/missions/);
  expect(saved).toMatchObject({
    title: 'Landscaping website',
    objective: 'Launch my landscaping website',
    next_actions: 'Review homepage brief',
    conversation_id: sent[0]?.conversationId,
    status: 'draft',
  });
  expect(sent).toHaveLength(1);
});
