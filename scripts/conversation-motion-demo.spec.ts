import { test, expect } from '@playwright/test';

const leadIn = 1200;
const settle = 1400;
const hold = 700;

async function stillLeadIn(page: import('@playwright/test').Page) {
  await page.waitForTimeout(leadIn);
}

async function settled(page: import('@playwright/test').Page) {
  await page.waitForTimeout(settle);
}

test('text and tool activity', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:3102/motion-integration.html');
  await expect(page.getByLabel('Message Aethelios', { exact: true })).toBeVisible();
  await stillLeadIn(page);
  await page.getByLabel('Message Aethelios', { exact: true }).fill('Review the week');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.locator('.assistant-message .im-status')).toHaveText('Preparing a reply');
  await page.waitForTimeout(hold);
  await page.getByRole('button', { name: 'Emit search event' }).click();
  await expect(page.locator('.assistant-message .im-status')).toHaveText('Searching the web');
  await page.waitForTimeout(hold);
  await page.getByRole('button', { name: 'Emit response text' }).click();
  await expect(page.locator('.message-markdown')).toContainText('Synthetic response');
  await page.waitForTimeout(hold);
  await page.getByRole('button', { name: 'Emit saving event' }).click();
  await expect(page.locator('.assistant-message .im-status')).toHaveText('Saving');
  await page.getByRole('button', { name: 'Confirm synthetic save' }).click();
  await expect(page.locator('.assistant-message .im-status')).toHaveText('Saved');
  await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/motion-text-tool-390.png' });
  await settled(page);
});

test('artifact approval and cancellation', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto('http://127.0.0.1:3102/motion-integration.html');
  await expect(page.getByLabel('Message Aethelios', { exact: true })).toBeVisible();
  await stillLeadIn(page);
  await page.getByLabel('Message Aethelios', { exact: true }).fill('Prepare an image');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.getByRole('button', { name: 'Emit completed image' }).click();
  await page.getByRole('button', { name: 'Emit image approval' }).click();
  await expect(page.locator('.assistant-message .im-status')).toHaveText(
    'Waiting for your approval',
  );
  await page.waitForTimeout(hold);
  await page.getByRole('button', { name: 'Emit image artifact' }).click();
  await expect(page.locator('.assistant-message .im-status')).toHaveText('Creating an image');
  await page.waitForTimeout(hold);
  await page.getByRole('button', { name: 'Stop reply' }).click();
  await expect(page.locator('.talk-creation-card[data-status="stopped"]')).toBeVisible();
  await expect(page.locator('.talk-creation-card[data-status="complete"]')).toBeVisible();
  await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/motion-artifact-cancel-768.png' });
  await settled(page);
});

test('voice states input output mute and silence', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:3102/motion-integration.html');
  await page.getByLabel('Surface', { exact: true }).selectOption('voice');
  await expect(page.locator('.im-living-voice-compact')).toBeVisible();
  await stillLeadIn(page);
  await page.getByLabel('Voice phase', { exact: true }).selectOption('listening');
  await page.getByLabel('Synthetic audio level', { exact: true }).fill('0.25');
  await page.waitForTimeout(hold);
  await page.getByLabel('Synthetic audio level', { exact: true }).fill('0.85');
  await page.waitForTimeout(hold);
  await page.getByLabel('Synthetic audio level', { exact: true }).fill('0');
  await page.waitForTimeout(hold);
  await page.getByLabel('Mute input').check();
  await page.waitForTimeout(hold);
  await page.getByLabel('Mute input').uncheck();
  await page.getByLabel('Voice phase', { exact: true }).selectOption('speaking');
  await page.getByLabel('Synthetic output level', { exact: true }).fill('0.7');
  await page.waitForTimeout(hold);
  await page.getByLabel('Block playback').check();
  await page.waitForTimeout(hold);
  await page.getByRole('button', { name: 'Pause ambient motion' }).click();
  await expect(page.locator('.im-living-voice-compact')).toHaveAttribute('data-motion', 'still');
  await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/motion-voice-390.png' });
  await settled(page);
});

test('keyboard fold layout and reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 690, height: 420 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('http://127.0.0.1:3102/motion-integration.html');
  await expect(page.getByLabel('Message Aethelios', { exact: true })).toBeVisible();
  await stillLeadIn(page);
  await page.getByLabel('Message Aethelios', { exact: true }).fill('Fold keyboard');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stop reply' })).toBeVisible();
  await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/motion-fold-keyboard-690.png' });
  await page.waitForTimeout(hold);
  await page.getByRole('button', { name: 'Stop reply' }).click();
  await expect(page.locator('.assistant-message .im-status')).toContainText('Stopped');
  await settled(page);
});
