import { test, expect } from '@playwright/test';
import type { WorkspaceData } from '../../src/domains/intelligence/types';
const state: WorkspaceData = {
  ownerId: 'synthetic-owner',
  conversations: [],
  turns: [
    {
      id: 'synthetic-turn',
      person_id: 'synthetic-owner',
      conversation_id: 'synthetic-conversation',
      user_text: 'Help me shape a clear plan for this week.',
      assistant_text:
        'Start with the decision that matters most.\n\n## Make room for focused work\n\nChoose one useful outcome, give it a protected block of time, and keep the next step small enough to begin.\n\n- Clarify the outcome.\n- Name the constraint.\n- Review what changed before adding more.',
      status: 'complete',
      model: 'synthetic-fixture',
      context_included: false,
      prompt_version: 'fixture',
      feedback: null,
      created_at: '2026-10-13',
      finished_at: '2026-10-13',
    },
  ],
  memories: [],
  actionProposals: [],
  context: {
    profile: {
      name: 'Synthetic',
      priority: 'Review',
      timezone: 'UTC',
      units: 'metric',
      updatedAt: '2026-10-13',
    },
    goal: null,
    memories: [],
  },
  canChat: true,
  configured: true,
  model: 'synthetic-fixture',
};
const field = (page: import('@playwright/test').Page) =>
  page.getByLabel('Message Aethelios', { exact: true });
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
    if (url.pathname.startsWith('/api/aurelius')) return route.fulfill({ json: state });
    return route.continue();
  });
});
for (const width of [320, 344, 390, 412, 720, 768, 960, 1100, 1101, 1440, 2560]) {
  test(`B+ controls, multiline growth and resize remain usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/app/aethelios');
    await field(page).fill('A detailed draft with several lines.\n'.repeat(30));
    await field(page).evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(12, 25));
    await expect(page.locator('[data-bplus-surface]')).toHaveCount(3);
    await expect(page.locator('.conversation-scroll .bplus-optics')).toHaveCount(0);
    await expect(
      page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link'),
    ).toHaveCount(6);
    const geometry = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      controls: [
        ...document.querySelectorAll(
          '.bplus-tools > button, .composer-controls > button, .talk-expand',
        ),
      ].map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, right: r.right, width: r.width, height: r.height };
      }),
      editor: document.querySelector('.talk-input')!.getBoundingClientRect().height,
      composer: document.querySelector('.aurelius-composer')!.getBoundingClientRect().width,
    }));
    expect(geometry.overflow).toBe(false);
    expect(geometry.editor).toBeLessThanOrEqual(201);
    expect(geometry.composer).toBeLessThanOrEqual(840);
    for (const control of geometry.controls) {
      expect(control.x).toBeGreaterThanOrEqual(0);
      expect(control.right).toBeLessThanOrEqual(width);
      expect(control.width).toBeGreaterThanOrEqual(44);
      expect(control.height).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole('button', { name: 'Tools & context', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Tools & context', exact: true })).toBeVisible();
    await expect(
      page.getByRole('dialog', { name: 'Tools & context', exact: true }).locator('.bplus-optics'),
    ).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Tools & context', exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'Expand writing space' }).click();
    await expect(page.getByLabel('Expanded message')).toHaveValue(
      'A detailed draft with several lines.\n'.repeat(30),
    );
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(field(page)).toBeFocused();
    expect(
      await field(page).evaluate((el: HTMLTextAreaElement) => [el.selectionStart, el.selectionEnd]),
    ).toEqual([12, 25]);
    await page.setViewportSize({ width, height: 420 });
    await expect(field(page)).toBeFocused();
    await expect
      .poll(() => field(page).evaluate((el) => el.getBoundingClientRect().height))
      .toBeLessThanOrEqual(102);
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeInViewport();
    await expect(field(page)).toHaveValue('A detailed draft with several lines.\n'.repeat(30));
  });
}
test('solid, forced colors and keyboard focus stay complete at runtime', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto('/app/aethelios');
  await field(page).fill('Keep this draft across material preferences');
  await page.getByRole('button', { name: 'Tools & context', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Tools & context', exact: true })
    .getByRole('button', { name: 'Use solid surfaces' })
    .click();
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).toHaveAttribute('data-material', 'solid');
  for (const surface of await page.locator('[data-bplus-surface]').all()) {
    await expect(surface.locator(':scope > .bplus-optics')).toBeHidden();
    await expect(surface).toHaveCSS('background-image', 'none');
  }
  const talk = page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Talk', exact: true });
  await talk.focus();
  await expect(talk).toHaveCSS('outline-width', '2px');
  await expect(talk).toHaveAttribute('aria-current', 'page');
  await page.emulateMedia({ forcedColors: 'active' });
  await expect(talk).toHaveCSS('outline-width', '2px');
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeEnabled();
  await expect(field(page)).toHaveValue('Keep this draft across material preferences');
});
test('Talk and Work retain distinct explicit material adoption', async ({ page }) => {
  await page.goto('/app/work');
  await expect(page.locator('.company-work')).toBeVisible();
  await expect(page.locator('[data-bplus="talk"]')).toHaveCount(0);
  await expect(page.locator('.company-work[data-bplus="work"]')).toBeVisible();
  await expect(page.locator('.company-work [data-bplus-surface]')).toHaveCount(2);
  await expect(page.locator('.company-job-list .bplus-optics')).toHaveCount(0);
  await expect(
    page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link'),
  ).toHaveCount(6);
});
