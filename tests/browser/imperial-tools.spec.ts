import { test, expect } from './fixtures';

test('Material conversation retains readable saved replies and stone writing space', async ({
  page,
}) => {
  await page.route('**/api/aurelius**', (route) =>
    route.fulfill({
      json: {
        ownerId: 'synthetic',
        conversations: [],
        memories: [],
        actionProposals: [],
        canChat: true,
        configured: true,
        model: 'synthetic',
        context: {
          profile: {
            name: 'Synthetic',
            priority: 'Build',
            timezone: 'UTC',
            units: 'metric',
            updatedAt: '2026-10-09',
          },
          goal: null,
          memories: [],
        },
        turns: [
          {
            id: 'synthetic',
            person_id: 'synthetic',
            conversation_id: 'synthetic',
            user_text: 'Review my material direction.',
            assistant_text: 'Keep the writing space clear and the environment dimensional.',
            status: 'complete',
            model: 'synthetic',
            context_included: false,
            prompt_version: 'synthetic',
            feedback: null,
            created_at: '2026-10-09',
            finished_at: '2026-10-09',
          },
        ],
      },
    }),
  );
  await page.goto('/app/aethelios');
  await expect(page.locator('.message-markdown')).toHaveCSS('color', 'rgb(246, 244, 237)');
  await expect(page.locator('.user-message p')).toHaveCSS('color', 'rgb(246, 244, 237)');
  await expect(page.locator('.assistant-message')).toHaveCSS('background-color', 'rgb(18, 20, 23)');
  await expect(page.locator('.aurelius-composer')).toHaveCSS(
    'background-color',
    'rgb(251, 248, 242)',
  );
  await expect(page.getByLabel('Message Aethelios', { exact: true })).toBeVisible();
});

// Synthetic project responses exercise controls without provider calls or private data.
for (const width of [360, 768, 1440]) {
  test(`Steel Studio controls preserve project drafts at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/api/studio', (route) =>
      route.fulfill({
        json: {
          projects: [
            {
              id: 'synthetic',
              title: 'Material exploration',
              creative_type: 'brand',
              brief: {},
              updated_at: '2026-10-09',
            },
          ],
          projectId: 'synthetic',
          versions: [],
          references: [],
          scenes: [],
          finishes: [],
          configured: false,
        },
      }),
    );
    await page.goto('/app/studio');
    const tabs = page.getByRole('group', { name: 'Studio workspace views' });
    await expect(tabs).toBeVisible();
    await expect(
      page.getByText(
        'Image generation is awaiting a server model connection. Projects and references remain available.',
      ),
    ).toBeVisible();
    await tabs.getByRole('button', { name: 'Direction', exact: true }).click();
    await page.getByLabel('Color direction').fill('Green, steel and ivory');
    await tabs.getByRole('button', { name: 'Library', exact: true }).click();
    await tabs.getByRole('button', { name: 'Direction', exact: true }).click();
    await expect(page.getByLabel('Color direction')).toHaveValue('Green, steel and ivory');
    const material = await tabs.evaluate((el) => ({
      foreground: getComputedStyle(el.querySelector('button')!).color,
      background: getComputedStyle(el).backgroundImage,
      overflow: document.documentElement.scrollWidth > innerWidth,
    }));
    expect(material.foreground).toBe('rgb(246, 244, 237)');
    expect(material.background).toContain('rgb(74, 84, 80)');
    expect(material.overflow).toBe(false);
    await expect(page.locator('.studio-main')).toHaveCSS('background-color', 'rgb(18, 20, 23)');
    await expect(page.locator('.studio-projects')).toHaveCSS('background-color', 'rgb(74, 84, 80)');
    await expect(page.locator('.studio-side-note p')).toHaveCSS('color', 'rgb(213, 217, 207)');
    await expect(page.locator('.topbar .capture-trigger')).toHaveCSS('color', 'rgb(24, 53, 43)');
    await expect(page.locator('.studio-direction')).toHaveCSS(
      'background-color',
      'rgb(246, 244, 237)',
    );
    await page.locator('body').click({ position: { x: 1, y: 1 } });
    await page.screenshot({
      path: `/workspace/steel-tools-review/studio-${width}.png`,
      fullPage: true,
    });
    await page.locator('html').evaluate((el) => el.setAttribute('data-material', 'solid'));
    await expect(tabs).toHaveCSS('background-image', 'none');
    await page.emulateMedia({ forcedColors: 'active' });
    await expect(tabs).toHaveCSS('background-image', 'none');
  });
}
