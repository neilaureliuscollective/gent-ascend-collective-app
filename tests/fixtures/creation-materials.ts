import { expect, type Page } from '@playwright/test';

export const materialConversation = '30000000-0000-4000-8000-000000000441';
export const materialProject = '60000000-0000-4000-8000-000000000441';
const time = '2026-10-15T03:00:00.000Z';
const turn = {
  id: '40000000-0000-4000-8000-000000000441',
  person_id: 'synthetic',
  conversation_id: materialConversation,
  user_text: 'Shape a focused launch plan for Aethelios Lifestyle.',
  assistant_text: 'Labelled material fixture. Review the brief and keep the scope precise.',
  status: 'complete',
  model: 'synthetic',
  context_included: false,
  prompt_version: 'fixture',
  feedback: null,
  created_at: time,
  finished_at: time,
};
const conversation = {
  id: materialConversation,
  person_id: 'synthetic',
  title: 'Aethelios Lifestyle launch',
  created_at: time,
  updated_at: time,
};
const workspace = {
  ownerId: 'synthetic',
  configured: true,
  canChat: true,
  model: 'synthetic-test-model',
  memories: [],
  actionProposals: [],
  context: {
    profile: {
      name: 'Synthetic',
      priority: 'Build',
      timezone: 'UTC',
      units: 'metric',
      updatedAt: '2026-10-15',
    },
    goal: null,
    memories: [],
  },
  conversations: [conversation],
  currentConversation: conversation,
  turns: [turn],
};
const creation = {
  id: '50000000-0000-4000-8000-000000000442',
  person_id: 'synthetic',
  conversation_id: materialConversation,
  source_turn_id: turn.id,
  lineage_id: '50000000-0000-4000-8000-000000000442',
  version: 1,
  kind: 'brief',
  content: {
    title: 'Aethelios Lifestyle launch',
    purpose: 'Introduce the line with a precise visual direction.',
    audience: 'Founders reviewing Aethelios Lifestyle.',
    visualDirection: 'Obsidian, emerald glass and restrained gold.',
    requirements: ['Phone-first reading'],
    unresolved: ['Final merchandising copy'],
  },
  predecessor_id: null,
  superseded_by: null,
  created_at: time,
};
const content = {
  name: 'Field notes studio',
  description: 'A labelled visual fixture for material review.',
  discipline: 'business',
  status: 'active',
  sources: [],
  documents: [
    {
      id: '70000000-0000-4000-8000-000000000441',
      title: 'Field notes studio — Business plan',
      kind: 'Business plan',
      content:
        '# Field notes studio\n\nA focused plan with a readable working document.\n\n## First useful outcome\n\nRecord a studio visit and review the next step.',
      status: 'draft',
      basis: 1,
    },
  ],
  blueprint: {
    vision: 'Create a focused studio-visit workspace.',
    audience: 'Studio visitors',
    opportunity: '',
    solution: '',
    requirements: '',
    research: '',
    architecture: '',
    decisions: '',
    milestones: '',
    deliverables: '',
    risks: '',
    state: 'Labelled material fixture.',
    next: 'Review the working document.',
  },
};
const project = {
  id: materialProject,
  person_id: 'synthetic',
  revision: 2,
  content,
  created_at: time,
  updated_at: time,
};

export async function installMaterialFixture(page: Page) {
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET') return route.abort();
    if (url.pathname === '/api/aurelius') return route.fulfill({ json: workspace });
    if (url.pathname === '/api/aurelius/creations')
      return route.fulfill({
        json: {
          creations: [creation],
          selected: { brief: creation.id },
          images: [],
          selectedImageId: null,
          canCreateImages: false,
          imageAccess: 'unavailable',
          attachmentProjectId: null,
        },
      });
    if (url.pathname === '/api/studio')
      return route.fulfill({
        json: {
          projects: [
            {
              id: materialProject,
              title: 'Field notes atelier',
              creative_type: 'brand',
              brief: {},
              updated_at: '2026-10-15',
            },
          ],
          projectId: materialProject,
          versions: [],
          references: [],
          scenes: [],
          finishes: [],
          designs: [],
          compositions: [],
          renders: [],
          designExports: [],
          narrations: [],
          footage: [],
          configured: false,
          canCreate: true,
          capabilities: {
            design: false,
            film: false,
            setup:
              'Design and Film need workspace setup. Existing Create, Campaign, Footage, Narration, Finish and Delivery remain available.',
          },
        },
      });
    if (url.pathname === '/api/architect-tools')
      return route.fulfill({ json: { tools: [], versions: [], invocations: [] } });
    if (url.pathname === '/api/architect-origin')
      return route.fulfill({ json: { projects: [project], versions: [], runs: [] } });
    return route.fulfill({ json: {} });
  });
}

export async function openMaterialTalk(page: Page) {
  await page.goto(`/app/aethelios?conversation=${materialConversation}`);
  await expect(page.getByLabel('Message Aethelios', { exact: true })).toBeVisible();
  await expect(page.locator('.talk-creation-card')).toBeVisible();
  await page
    .getByLabel('Message Aethelios', { exact: true })
    .fill('Review the direction and preserve this unsent draft.');
}

export async function openMaterialArchitect(page: Page) {
  await page.goto(`/app/architect?project=${materialProject}`);
  await expect(page.getByRole('button', { name: 'Blueprint', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Blueprint', exact: true }).click();
  await expect(page.getByLabel('Blueprint section')).toBeVisible();
}

export async function openMaterialDocument(page: Page) {
  await page.getByRole('button', { name: 'Deliverables', exact: true }).click();
  const library = page.locator('.origin-document-library');
  if (!(await library.evaluate((node) => (node as HTMLDetailsElement).open)))
    await library.locator('summary').click();
  await page.getByLabel('Selected document').selectOption(content.documents[0]!.id);
  if (await library.evaluate((node) => (node as HTMLDetailsElement).open))
    await library.locator('summary').click();
  await expect(page.getByLabel('Editable Markdown')).toBeVisible();
}

export async function openMaterialStudio(page: Page) {
  await page.goto('/app/studio');
  await expect(
    page.getByRole('heading', { name: 'Field notes atelier', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('group', { name: 'Studio workspace views' })).toBeVisible();
}
