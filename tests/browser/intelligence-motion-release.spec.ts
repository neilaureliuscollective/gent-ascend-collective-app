import { test, expect } from './fixtures';
import type { WorkspaceData } from '../../src/domains/intelligence/types';
const workspace: WorkspaceData = {
  ownerId: 'synthetic',
  conversations: [],
  turns: [],
  memories: [],
  actionProposals: [],
  context: {
    profile: {
      name: 'Synthetic',
      priority: 'Build',
      timezone: 'UTC',
      units: 'metric',
      updatedAt: '2026-10-12',
    },
    goal: null,
    memories: [],
  },
  canChat: true,
  configured: true,
  model: 'synthetic-test-model',
};
for (const width of [344, 768, 1440]) {
  test(`production Talk retains identity and request feedback at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/api/aurelius**', (route) => route.fulfill({ json: workspace }));
    await page.goto('/app/aethelios');
    await expect(page.getByLabel('Message Aethelios', { exact: true })).toBeVisible();
    // The shared authored signal is visible without a hidden legacy GPU renderer.
    await expect(page.locator('.talk-presence .identity-presence').first()).toBeVisible();
    await expect(page.locator('.talk-presence canvas')).toHaveCount(0);
    await page.getByRole('button', { name: 'Aethelios presence', exact: true }).click();
    const drawer = page.getByRole('dialog', { name: 'Aethelios presence', exact: true });
    await expect(drawer.getByText('Ready when you are', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await page
      .getByLabel('Message Aethelios', { exact: true })
      .fill('Preserve this unsent thought');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('.talk-presence .im-presence').first()).toHaveAttribute(
      'data-motion',
      'still',
    );
    await expect(page.getByLabel('Message Aethelios', { exact: true })).toHaveValue(
      'Preserve this unsent thought',
    );
    await page.screenshot({ path: `test-results/motion-talk-${width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(errors).toEqual([]);
  });
}
test('motion mark pauses offscreen and respects Still without a repeating completion', async ({
  page,
}) => {
  await page.goto('http://127.0.0.1:3102/motion.html');
  const mark = page.locator('.gallery-stage .im-presence');
  await expect(mark).toHaveAttribute('data-animate', 'true');
  await page.getByLabel('Preview state').selectOption('searching');
  const orbit = mark.locator('.identity-flow');
  await expect(orbit).not.toHaveCSS('animation-name', 'none');
  await page.getByLabel('Preview state').selectOption('complete');
  await expect(mark.locator('.identity-focus')).toHaveCSS('animation-iteration-count', '1');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(mark).toHaveAttribute('data-animate', 'false');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole('button', { name: 'Pause ambient motion' }).click();
  await expect(mark).toHaveAttribute('data-motion', 'still');
  await expect(mark.locator('.identity-focus')).toHaveCSS('animation-name', 'none');
});
