import { test, expect } from '@playwright/test';

test.use({
  video: { mode: 'on', size: { width: 390, height: 844 } },
  viewport: { width: 390, height: 844 },
});

test('text submit waiting stream complete', async ({ page }) => {
  await page.goto('http://127.0.0.1:3102/motion-integration.html');
  await page.getByLabel('Message Aethelios', { exact: true }).fill('Hey');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.locator('.assistant-message .im-status')).toHaveText('Preparing a reply');
  await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/after-waiting-390.png' });
  await page.getByRole('button', { name: 'Emit search event' }).click();
  await expect(page.locator('.assistant-message .im-status')).toHaveText('Searching the web');
  await page.getByRole('button', { name: 'Emit response text' }).click();
  await expect(page.locator('.message-markdown')).toContainText('Synthetic response');
  await page.getByRole('button', { name: 'Emit saving event' }).click();
  await expect(page.locator('.assistant-message .im-status')).toHaveText('Saving');
  await page.getByRole('button', { name: 'Confirm synthetic save' }).click();
  await expect(page.locator('.assistant-message .im-status')).toHaveText('Saved');
  await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/after-saved-390.png' });
});

test('artifact and uncertain save', async ({ page }) => {
  await page.goto('http://127.0.0.1:3102/motion-integration.html');
  await page.getByLabel('Message Aethelios', { exact: true }).fill('Make an image');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.getByRole('button', { name: 'Emit image artifact' }).click();
  await expect(page.locator('.talk-creation-card[data-in-flight]')).toBeVisible();
  await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/after-artifact-390.png' });
  await page.getByRole('button', { name: 'Emit failure' }).click();
  await expect(page.locator('.assistant-message .im-status')).toContainText('Save unconfirmed');
  await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/after-uncertain-390.png' });
});

test('voice envelope and still', async ({ page }) => {
  await page.goto('http://127.0.0.1:3102/motion-integration.html');
  await page.getByLabel('Surface', { exact: true }).selectOption('voice');
  await page.getByLabel('Voice phase', { exact: true }).selectOption('listening');
  await page.getByLabel('Synthetic audio level', { exact: true }).fill('0.2');
  await page.waitForTimeout(400);
  await page.getByLabel('Synthetic audio level', { exact: true }).fill('0.85');
  await page.waitForTimeout(400);
  await page.getByLabel('Voice phase', { exact: true }).selectOption('speaking');
  await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/after-voice-390.png' });
  await page.getByRole('button', { name: 'Pause ambient motion' }).click();
  await expect(page.locator('.im-living-voice-compact')).toHaveAttribute('data-motion', 'still');
});

test('fold keyboard and reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 690, height: 420 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('http://127.0.0.1:3102/motion-integration.html');
  await page.getByLabel('Message Aethelios', { exact: true }).fill('Fold keyboard');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stop reply' })).toBeVisible();
  await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/after-fold-keyboard-690.png' });
  await page.getByRole('button', { name: 'Stop reply' }).click();
  await expect(page.locator('.assistant-message .im-status')).toContainText('Stopped');
});
