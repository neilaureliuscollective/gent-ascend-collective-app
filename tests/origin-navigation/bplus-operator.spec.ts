import { test, expect, type Page } from '@playwright/test';
import {
  initialProject,
  type OriginProject,
  type OriginVersion,
} from '../../src/domains/architect-origin/schema';
const projectId = '0b000000-0000-4000-8000-000000000001';
const documentId = '0d000000-0000-4000-8000-000000000001';
async function fixture(page: Page) {
  const project: OriginProject = {
    id: projectId,
    person_id: 'synthetic-owner',
    revision: 3,
    created_at: '',
    updated_at: '',
    content: {
      ...initialProject('Synthetic operator workspace', 'application'),
      name: 'Synthetic operator project',
      documents: [
        {
          id: documentId,
          title: 'Synthetic brief',
          kind: 'Business plan',
          status: 'draft',
          basis: 3,
          content: '# Synthetic brief\n\nConfirmed saved content.',
        },
      ],
    },
  };
  const versions: OriginVersion[] = [];
  const saves: unknown[] = [];
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
    if (url.pathname === '/api/companies') return route.fulfill({ json: { companies: [] } });
    if (url.pathname !== '/api/architect-origin') return route.continue();
    if (route.request().method() === 'GET')
      return route.fulfill({ json: { projects: [project], versions, runs: [] } });
    const body = route.request().postDataJSON();
    expect(body.action).toBe('save');
    expect(body.expected).toBe(project.revision);
    saves.push(body);
    project.revision++;
    project.content = body.content;
    versions.push({
      id: body.requestId,
      project_id: project.id,
      person_id: project.person_id,
      revision: project.revision,
      content: body.content,
      note: body.note,
      created_at: '',
    });
    return route.fulfill({
      json: { revision: project.revision, requestId: body.requestId, personId: project.person_id },
    });
  });
  return { saves };
}
for (const width of [320, 390, 720, 1440]) {
  test(`Work and Architect material roles preserve editing and discard at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await fixture(page);
    await page.goto('/app/work');
    await expect(page.locator('.company-work[data-bplus="work"]')).toBeVisible();
    await expect(page.locator('.company-work [data-bplus-surface]')).toHaveCount(2);
    await expect(page.locator('.company-job-list .bplus-optics')).toHaveCount(0);
    const work = page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'Work', exact: true });
    await expect(work).toHaveAttribute('aria-current', 'page');
    await expect(work.locator(':scope > .bplus-optics')).toBeVisible();
    await page.getByRole('link', { name: 'Open Architect ↗', exact: true }).click();
    await expect(page.locator('.origin[data-bplus="architect"]')).toBeVisible();
    await expect(
      page.locator('.origin-starters [aria-pressed="true"] > .bplus-optics'),
    ).toBeVisible();
    await page.getByRole('button', { name: /Synthetic operator project/ }).click();
    const blueprint = page.getByRole('button', { name: 'Blueprint', exact: true });
    await blueprint.click();
    await expect(blueprint.locator(':scope > .bplus-optics')).toBeVisible();
    await expect(page.locator('.origin-plane > .bplus-optics')).toHaveCount(0);
    await expect(page.locator('.origin-plane')).toHaveCSS('background-color', 'rgb(7, 11, 10)');
    const vision = page.getByLabel('Project vision', { exact: true });
    await vision.fill(`Reviewed direction at ${width}px`);
    const save = page.getByRole('button', { name: 'Save & confirm revision' });
    await expect(save).toBeEnabled();
    await expect(save.locator(':scope > .bplus-optics')).toBeVisible();
    await save.click();
    await expect(page.getByRole('status')).toContainText('Saved revision 4');
    await expect(save).toBeDisabled();
    await expect(save.locator(':scope > .bplus-optics')).toBeHidden();
    await page.getByRole('button', { name: 'Deliverables', exact: true }).click();
    await page.getByLabel('Selected document').selectOption(documentId);
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    const markdown = page.getByLabel('Editable Markdown');
    await markdown.fill('Private material review draft');
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await expect(page.locator('.origin-document-preview')).toContainText(
      'Private material review draft',
    );
    await expect(page.locator('.origin-document-preview .bplus-optics')).toHaveCount(0);
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(markdown).toHaveValue('Private material review draft');
    await page.getByRole('button', { name: 'Focus canvas', exact: true }).click();
    await expect(page.locator('.origin-conversation')).toBeHidden();
    await expect(markdown).toHaveValue('Private material review draft');
    page.once('dialog', (d) => d.dismiss());
    await page.getByRole('button', { name: 'Discard draft', exact: true }).click();
    await expect(markdown).toHaveValue('Private material review draft');
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Discard draft', exact: true }).click();
    await expect(markdown).toHaveValue('# Synthetic brief\n\nConfirmed saved content.');
    expect(state.saves).toHaveLength(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(
      page.getByText('AI generation and live research are unavailable here.', { exact: false }),
    ).toBeHidden();
  });
}
test('Architect optics respect solid, forced colors, focus and disabled save state', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await fixture(page);
  await page.goto(`/app/architect?project=${projectId}&surface=Blueprint&section=vision`);
  const vision = page.getByLabel('Project vision', { exact: true });
  await vision.fill('Retain this draft across appearance preferences');
  await page.getByRole('button', { name: 'Aethelios menu', exact: true }).click();
  await page.getByRole('button', { name: 'Use solid surfaces', exact: true }).click();
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-material', 'solid');
  for (const surface of await page.locator('.origin [data-bplus-surface]').all()) {
    await expect(surface.locator(':scope > .bplus-optics')).toBeHidden();
  }
  const blueprint = page.getByRole('button', { name: 'Blueprint', exact: true });
  await page.keyboard.press('Tab');
  await blueprint.focus();
  await expect.poll(() => blueprint.evaluate((el) => el.matches(':focus-visible'))).toBe(true);
  await expect(blueprint).toBeFocused();
  await expect(blueprint).toHaveCSS('outline-width', '2px');
  await page.emulateMedia({ forcedColors: 'active' });
  await expect(blueprint).toHaveCSS('outline-width', '2px');
  await expect(vision).toHaveValue('Retain this draft across appearance preferences');
  await expect(page.getByRole('button', { name: 'Save & confirm revision' })).toBeEnabled();
});
