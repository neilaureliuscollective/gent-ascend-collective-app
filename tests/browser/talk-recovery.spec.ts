import { test, expect, type Page } from './fixtures';
import { disconnectedWorkspace } from '../../src/components/aurelius/preview';
import type { Turn } from '../../src/domains/intelligence/types';
const field = (page: Page) => page.getByLabel('Message Aethelios', { exact: true });
async function fixture(page: Page) {
  const data = {
    ...disconnectedWorkspace,
    ownerId: 'audit-owner',
    configured: true,
    canChat: true,
    model: 'synthetic',
    turns: [] as Turn[],
  };
  let metadataReads = 0;
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    const calls: string[] = [];
    (window as unknown as { webglCalls: string[] }).webglCalls = calls;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: Parameters<typeof original>
    ) {
      if (args[0] === 'webgl2') calls.push(String(this.closest('dialog')?.open));
      return original.apply(this, args);
    } as typeof original;
  });
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
    if (url.pathname === '/api/aurelius/chat') {
      const body = route.request().postDataJSON();
      await new Promise((resolve) => setTimeout(resolve, 200));
      const turn: Turn = {
        id: body.requestId,
        person_id: data.ownerId,
        conversation_id: body.conversationId,
        user_text: body.text,
        assistant_text: 'Synthetic saved response.',
        status: 'complete',
        model: 'synthetic',
        context_included: false,
        prompt_version: 'fixture',
        feedback: null,
        created_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
      };
      data.turns.push(turn);
      return route.fulfill({
        contentType: 'application/x-ndjson',
        body: [
          { type: 'activity', phase: 'generating' },
          { type: 'delta', text: turn.assistant_text },
          { type: 'saved', turn },
        ]
          .map((x) => JSON.stringify(x) + '\n')
          .join(''),
      });
    }
    if (url.pathname === '/api/aurelius') {
      const snapshot = JSON.stringify(data);
      if (data.turns.length) {
        metadataReads++;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      return route.fulfill({ contentType: 'application/json', body: snapshot }).catch(() => {});
    }
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: {} });
    return route.continue();
  });
  return { data, metadataReads: () => metadataReads };
}
test('ambient repeated requests allocate no WebGL and confirmed saves release sending before metadata', async ({
  page,
}) => {
  const mock = await fixture(page);
  await page.addInitScript(() => localStorage.setItem('aurelius-motion', 'ambient'));
  await page.goto('/app/aethelios');
  await expect(page.locator('.talk-welcome-presence .identity-presence')).toHaveCSS('opacity', '1');
  await field(page).fill('First synthetic thought');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stop reply' })).toBeVisible();
  await expect(page.locator('.im-response[data-phase="complete"]')).toBeVisible();
  await field(page).fill('Next synthetic thought');
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeEnabled();
  expect(mock.metadataReads()).toBe(1);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.locator('.conversation-turn')).toHaveCount(2);
  await expect(page.locator('.conversation-turn').last()).toContainText('Next synthetic thought');
  await expect(page.locator('.im-response[data-phase="complete"]')).toBeVisible();
  await page.waitForTimeout(2200);
  await expect(page.locator('.conversation-turn')).toHaveCount(2);
  expect(
    await page.evaluate(() => (window as unknown as { webglCalls: string[] }).webglCalls),
  ).toEqual([]);
  await page.getByRole('button', { name: 'Aethelios presence', exact: true }).click();
  await expect(
    page
      .getByRole('dialog', { name: 'Aethelios presence', exact: true })
      .locator('.identity-presence'),
  ).toHaveCSS('opacity', '1');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Aethelios presence', exact: true })).toBeFocused();
});
for (const width of [344, 390, 720, 768, 1440])
  test(`one header and usable transcript in both keyboard modes at ${width}`, async ({ page }) => {
    await fixture(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/app/aethelios');
    await expect(page.getByRole('heading', { name: 'Aethelios', exact: true })).toBeInViewport();
    expect(
      await page.locator('.talk-title').evaluate((e) => e.getBoundingClientRect().width),
    ).toBeGreaterThan(50);
    await field(page).fill('Growing composer\n'.repeat(50));
    await field(page).focus();
    await page.setViewportSize({ width, height: 420 });
    await expect(page.locator('.talk-page')).toHaveAttribute('data-keyboard', 'open');
    await expect(field(page)).toBeFocused();
    await expect
      .poll(() =>
        page.locator('.conversation-scroll').evaluate((e) => e.getBoundingClientRect().height),
      )
      .toBeGreaterThan(140);
    await expect(page.locator('.navigation')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeInViewport();
    await page.screenshot({ path: `test-results/talk-recovery-${width}-keyboard.png` });
    await page.setViewportSize({ width, height: 900 });
    await field(page).focus();
    await page.evaluate(() => {
      Object.defineProperty(visualViewport, 'height', { configurable: true, get: () => 420 });
      visualViewport!.dispatchEvent(new Event('resize'));
    });
    await expect(page.locator('.talk-page')).toHaveAttribute('data-keyboard', 'open');
    await expect
      .poll(() =>
        page.locator('.conversation-scroll').evaluate((e) => e.getBoundingClientRect().height),
      )
      .toBeGreaterThan(140);
    await expect(field(page)).toHaveValue('Growing composer\n'.repeat(50));
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
  });
test('drafts survive refresh and Back, separate conversations, and never cross verified accounts', async ({
  page,
}) => {
  const mock = await fixture(page);
  await page.goto('/app/aethelios');
  await field(page).fill('Unsent private draft');
  await page.reload();
  await expect(field(page)).toHaveValue('Unsent private draft');
  await page.getByRole('button', { name: 'Tools & context', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Aethelios destinations' })
    .getByRole('link', { name: 'Work', exact: true })
    .click();
  await expect(page).toHaveURL(/\/app\/work$/);
  await page.goBack();
  await expect(field(page)).toHaveValue('Unsent private draft');
  await page.goto('/app/aethelios?conversation=00000000-0000-4000-8000-000000000012');
  await expect(field(page)).toHaveValue('');
  await field(page).fill('Other conversation draft');
  await page.goto('/app/aethelios');
  await expect(field(page)).toHaveValue('Unsent private draft');
  mock.data.ownerId = 'other-owner';
  await page.reload();
  await expect(field(page)).toHaveValue('');
  mock.data.ownerId = 'audit-owner';
  await page.reload();
  await expect(field(page)).toHaveValue('');
});
test('pending saved-state rows after reload cannot silently start a duplicate reply', async ({
  page,
}) => {
  const mock = await fixture(page);
  mock.data.turns.push({
    id: 'pending',
    conversation_id: 'pending-thread',
    person_id: 'audit-owner',
    user_text: 'Unresolved',
    assistant_text: '',
    status: 'pending',
    model: 'synthetic',
    context_included: false,
    prompt_version: 'fixture',
    feedback: null,
    created_at: '2026-10-13',
    finished_at: null,
  });
  await page.goto('/app/aethelios');
  await field(page).fill('Next thought');
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeDisabled();
  await expect(page.locator('.form-feedback[role=alert]')).toContainText('unresolved');
});
test('a reading message stays anchored across Fold-like width changes', async ({ page }) => {
  const mock = await fixture(page);
  mock.data.turns = Array.from({ length: 30 }, (_, index) => ({
    id: `saved-${index}`,
    person_id: 'audit-owner',
    conversation_id: 'saved-thread',
    user_text: `Question ${index}`,
    assistant_text: 'Saved paragraph for reading and reflow. '.repeat(35),
    status: 'complete' as const,
    model: 'synthetic',
    context_included: false,
    prompt_version: 'fixture',
    feedback: null,
    created_at: '2026-10-13',
    finished_at: '2026-10-13',
  }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app/aethelios');
  const transcript = page.locator('.conversation-scroll');
  await expect(page.locator('[data-turn-id]')).toHaveCount(30);
  await transcript.evaluate((el) => {
    const row = el.querySelector<HTMLElement>('[data-turn-id="saved-15"]')!;
    el.scrollTop += row.getBoundingClientRect().top - el.getBoundingClientRect().top - 20;
    el.dispatchEvent(new Event('scroll'));
  });
  await page.waitForTimeout(50);
  const before = await transcript.evaluate((el) => {
    const top = el.getBoundingClientRect().top;
    const row = [...el.querySelectorAll<HTMLElement>('[data-turn-id]')].find(
      (r) => r.getBoundingClientRect().bottom > top,
    )!;
    return { id: row.dataset.turnId, offset: row.getBoundingClientRect().top - top };
  });
  await page.setViewportSize({ width: 768, height: 844 });
  await expect
    .poll(() =>
      transcript.evaluate((el, anchor) => {
        const row = [...el.querySelectorAll<HTMLElement>('[data-turn-id]')].find(
          (r) => r.dataset.turnId === anchor.id,
        )!;
        return Math.abs(
          row.getBoundingClientRect().top - el.getBoundingClientRect().top - anchor.offset,
        );
      }, before),
    )
    .toBeLessThan(3);
  await expect(page.getByRole('button', { name: 'Latest message' })).toBeVisible();
});
test('secondary Council stays accessible after closing tools and from the composer', async ({
  page,
}) => {
  await fixture(page);
  await page.goto('/app/aethelios');
  await field(page).fill('A synthetic discussion');
  await page.getByRole('button', { name: 'Tools & context', exact: true }).click();
  await page.getByRole('button', { name: 'Meet the Intelligence Team', exact: true }).click();
  const council = page.getByRole('dialog', { name: 'Your Entities', exact: true });
  await expect(council).toBeVisible();
  await council.getByRole('button', { name: 'Involve Athena', exact: true }).click();
  await page.keyboard.press('Escape');
  await field(page).focus();
  await expect(field(page)).toHaveValue('A synthetic discussion');
  await expect(field(page)).toHaveAttribute('placeholder', /Athena/);
});
