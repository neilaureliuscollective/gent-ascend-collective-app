import { test, expect } from './fixtures';
import { disconnectedWorkspace } from '../../src/components/aurelius/preview';

const state = {
  ...disconnectedWorkspace,
  ownerId: 'synthetic-owner',
  configured: true,
  canChat: true,
  turns: Array.from({ length: 40 }, (_, index) => ({
    id: `synthetic-turn-${index}`,
    person_id: 'synthetic-owner',
    conversation_id: 'synthetic-conversation',
    user_text: 'Synthetic history for viewport review.',
    assistant_text: 'Synthetic long saved answer.\n\n'.repeat(20),
    status: 'complete',
    model: 'synthetic-fixture',
    context_included: false,
    prompt_version: 'fixture',
    feedback: null,
    created_at: '2026-10-13',
    finished_at: '2026-10-13',
  })),
};
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
    if (url.pathname.startsWith('/api/aurelius')) return route.fulfill({ json: state });
    return route.continue();
  });
});
for (const [width, height] of [
  [390, 844],
  [390, 420],
  [1440, 900],
] as const) {
  test(`Latest message stays above short and grown composers at ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/app/aethelios');
    const field = page.getByLabel('Message Aethelios', { exact: true });
    for (const draft of ['A short draft', 'Long synthetic draft\n'.repeat(40)]) {
      await field.fill(draft);
      await page.locator('.conversation-scroll').evaluate((el) => {
        el.scrollTop = 0;
        el.dispatchEvent(new Event('scroll'));
      });
      const latest = page.getByRole('button', { name: 'Latest message' });
      await expect(latest).toBeVisible();
      await expect
        .poll(async () => {
          const [button, composer] = await Promise.all([
            latest.boundingBox(),
            page.locator('.aurelius-composer').boundingBox(),
          ]);
          return button!.y + button!.height <= composer!.y;
        })
        .toBe(true);
      await expect(latest).toBeInViewport();
      await latest.click();
      await expect
        .poll(() =>
          page
            .locator('.conversation-scroll')
            .evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop),
        )
        .toBeLessThan(5);
      await expect(field).toHaveValue(draft);
    }
  });
}
test('queued drawer close respects a newer keyboard focus target in forced colors', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto('/app/aethelios');
  const field = page.getByLabel('Message Aethelios', { exact: true });
  await field.fill('Keep this draft during close and focus');
  const trigger = page.getByRole('button', { name: 'Tools & context', exact: true });
  await trigger.click();
  await page
    .getByRole('dialog', { name: 'Tools & context', exact: true })
    .getByRole('button', { name: 'Use solid surfaces' })
    .click();
  await page.keyboard.press('Tab');
  // Native close queues its event. A newer focus choice must survive that event.
  await page.evaluate(async () => {
    const dialog = document.querySelector<HTMLDialogElement>('dialog[open]')!;
    const talk = document.querySelector<HTMLTextAreaElement>('.talk-input')!;
    const closed = new Promise<void>((resolve) =>
      dialog.addEventListener('close', () => setTimeout(resolve, 0), { once: true }),
    );
    dialog.close();
    talk.focus();
    await closed;
  });
  const talk = field;
  await expect(talk).toBeFocused();
  await page.emulateMedia({ forcedColors: 'active' });
  await expect(talk).toBeFocused();
  await expect(talk).toHaveCSS('outline-style', 'none');
  await expect(page.locator('.talk-page .aurelius-composer')).toHaveCSS('outline-width', '2px');
  await expect(field).toHaveValue('Keep this draft during close and focus');
  // Ordinary Escape still returns to the invoking control.
  await trigger.click();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});
