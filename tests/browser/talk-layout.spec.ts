import { test, expect } from './fixtures';
import type { WorkspaceData } from '../../src/domains/intelligence/types';
const state: WorkspaceData = {
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
      updatedAt: '2026-10-06',
    },
    goal: null,
    memories: [],
  },
  canChat: true,
  configured: true,
  model: 'synthetic-test-model',
};
for (const width of [320, 360, 390, 412, 768, 1440]) {
  test(`Talk reserves space for messages and preserves editor drafts at ${width}px`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/api/aurelius**', (route) => route.fulfill({ json: state }));
    await page.goto('/app/aethelios');
    await expect(page.getByLabel('Message Aethelios', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Memory', exact: true })).not.toBeVisible();
    const heights = await page.evaluate(() => ({
      app: document.querySelector('.aethelios-page')!.getBoundingClientRect().height,
      transcript: document.querySelector('.conversation-scroll')!.getBoundingClientRect().height,
      composer: document.querySelector('.aurelius-composer')!.getBoundingClientRect().height,
      overflow: document.documentElement.scrollWidth > innerWidth,
    }));
    expect(heights.overflow).toBe(false);
    expect(heights.transcript / heights.app).toBeGreaterThan(0.6);
    expect(heights.composer).toBeLessThanOrEqual(112);
    await page.getByLabel('Message Aethelios', { exact: true }).fill('Keep this company draft');
    await page.getByRole('button', { name: 'Expand writing space', exact: true }).click();
    await page.getByLabel('Expanded message').fill('Keep this company draft and revision');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.getByLabel('Message Aethelios', { exact: true })).toHaveValue(
      'Keep this company draft and revision',
    );
    await expect(page.getByLabel('Message Aethelios', { exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'Tools & context', exact: true }).click();
    await page.getByRole('button', { name: 'Memory', exact: true }).click();
    await expect(page.getByLabel('What should Aethelios remember?')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Tools & context', exact: true })).toBeFocused();
    await expect(page.getByLabel('Message Aethelios', { exact: true })).toHaveValue(
      'Keep this company draft and revision',
    );
    await page.getByRole('button', { name: 'Conversations', exact: true }).click();
    await expect(page.getByPlaceholder('Search conversations')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width, height: 420 });
    await expect(page.getByLabel('Message Aethelios', { exact: true })).toBeInViewport();
    expect(errors).toEqual([]);
  });
}
