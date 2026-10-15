// Local fixture evidence for Architect arrival / shape / focus. Not a commissioned or paid build.
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:3102/app/architect?mode=architect-origin&apps=adapter';
const evidence = 'docs/evidence/architect-apps';
mkdirSync(evidence, { recursive: true });
mkdirSync('test-results', { recursive: true });

const plannerPreview = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Labelled fixture preview</title>
<style>
  html,body{margin:0;background:#101412;color:#f2f2ee;font:15px/1.45 ui-sans-serif,system-ui;height:100%}
  .banner{padding:8px 14px;background:#1a1a1a;color:#c4912f;font-size:11px;letter-spacing:.12em;text-transform:uppercase}
  header{display:flex;justify-content:space-between;align-items:center;padding:18px 22px 8px}
  h1{margin:0;font-size:28px;font-weight:500}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:0 22px 22px}
  article{border:1px solid #3a403c;border-radius:14px;overflow:hidden;background:#1a1e1c}
  .shot{height:120px;background:linear-gradient(135deg,#3d6a5c,#c4912f66)}
  article h2{margin:0;padding:12px 14px 0;font-size:16px}
  article p{margin:0;padding:4px 14px 14px;color:#b9bebb;font-size:13px}
  ol{margin:0;padding:8px 22px 22px;list-style:none}
  li{display:grid;grid-template-columns:18px 1fr 90px;gap:10px;padding:10px 0;border-bottom:1px solid #2a2d2a}
  .dot{width:12px;height:12px;border-radius:50%;border:2px solid #c4912f;margin-top:4px}
  .done{background:#245b48;border-color:#245b48}
</style></head><body>
<p class="banner">Labelled fixture preview — not a commissioned or paid build</p>
<header><div><h1>Projects</h1><p>Plan, build and deliver with clarity.</p></div><p>Current revision</p></header>
<div class="grid">
  <article><div class="shot"></div><h2>Riverside Brand</h2><p>Brand identity · Active</p></article>
  <article><div class="shot"></div><h2>Atelier Website</h2><p>Experience · In progress</p></article>
</div>
<ol>
  <li><span class="dot done"></span><span>Discovery</span><span>Mar 10</span></li>
  <li><span class="dot done"></span><span>Concept direction</span><span>Mar 17</span></li>
  <li><span class="dot"></span><span>Client review</span><span>Mar 24</span></li>
</ol>
</body></html>`;

function appsLibrary() {
  return {
    app: { id: 'app-1', current_revision: 1, last_working_revision: 1, name: 'Studio planner' },
    revisions: [
      {
        id: 'rev-1',
        revision: 1,
        status: 'ready',
        working: true,
        approval_hash: 'hash',
        generation: { mode: 'fixture', notes: 'Labelled fixture preview' },
        files: [{ path: 'src/App.tsx', content: 'export function App(){return null}' }],
        collections: [{ name: 'projects' }],
      },
    ],
    jobs: [
      {
        id: 'job-1',
        revision_id: 'rev-1',
        status: 'complete',
        cancel_requested: false,
        result: { ok: true, isolation: 'none', typecheck: { ok: true }, bundle: { ok: true } },
      },
    ],
    events: [{ kind: 'preview-ready', detail: 'Labelled fixture preview mounted', created_at: new Date().toISOString() }],
    current: { id: 'rev-1', revision: 1, status: 'ready', working: true, approval_hash: 'hash' },
    working: { id: 'rev-1', revision: 1 },
    selected: { id: 'rev-1', revision: 1, status: 'ready', working: true },
    preview: {
      srcDoc: plannerPreview,
      sandbox: 'allow-scripts allow-forms',
      label: 'Labelled fixture preview',
      revision: 1,
      revisionId: 'rev-1',
      generation: 1,
    },
    previewSession: 'fixture-session',
    pendingStart: null,
    records: { projects: [{ id: 'p1', title: 'Riverside Brand' }] },
    provider: { enabled: true, mode: 'fixture', reason: null },
    profile: { id: 'notes', version: 'fixture', toolchain: 'host-fixture' },
    capabilities: {},
  };
}

function attachRoutes(page) {
  const state = { project: null, versions: [] };
  page.route('**/api/architect-origin*', async (route) => {
    if (route.request().method() === 'GET')
      return route.fulfill({ json: { projects: state.project ? [state.project] : [], versions: state.versions, runs: [] } });
    const body = route.request().postDataJSON();
    if (body.action === 'save') {
      const now = new Date().toISOString();
      state.project = {
        id: body.projectId,
        person_id: 'owner',
        revision: body.expected + 1,
        content: body.content,
        created_at: now,
        updated_at: now,
      };
      state.versions.unshift({
        id: body.requestId,
        project_id: body.projectId,
        person_id: 'owner',
        revision: state.project.revision,
        content: body.content,
        note: body.note,
        created_at: now,
      });
      return route.fulfill({ json: { revision: state.project.revision, requestId: body.requestId, personId: 'owner' } });
    }
    return route.fulfill({ json: { run: { id: body.requestId, status: 'complete', output: { reply: 'Fixture', changes: [] } } } });
  });
  page.route('**/api/architect-apps**', async (route) => {
    return route.fulfill({ json: appsLibrary() });
  });
  return state;
}

async function shot(page, name) {
  await page.waitForTimeout(280);
  await page.screenshot({ path: `${evidence}/${name}.png`, animations: 'disabled' });
  await page.screenshot({ path: `test-results/${name}.png`, animations: 'disabled' });
}

const timings = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  recordVideo: { dir: `${evidence}/world-video`, size: { width: 1440, height: 900 } },
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'no-preference',
});
const page = await context.newPage();
const state = attachRoutes(page);

const navStart = Date.now();
await page.goto(base, { waitUntil: 'networkidle' });
await page.getByRole('heading', { name: 'What will you create?' }).waitFor();
timings.push({ name: 'arrival-heading', ms: Date.now() - navStart });
await shot(page, 'world-arrival-1440');

const typeStart = Date.now();
await page.getByLabel('Tell Aethelios what you want to create').fill('A planning app for independent studios.');
timings.push({ name: 'idea-input', ms: Date.now() - typeStart });

const pathStart = Date.now();
await page.getByRole('button', { name: 'Design an Application' }).click();
await page.getByLabel('Design an Application working stage').waitFor();
timings.push({ name: 'path-open', ms: Date.now() - pathStart });
await page.getByRole('radio', { name: /Create a project/i }).check();
await page.getByLabel('Tell Aethelios what you want to create').scrollIntoViewIfNeeded();
await shot(page, 'world-shape-1440');

await page.getByLabel('Project name (optional)').fill('Studio planner');
await page.getByRole('button', { name: 'Create & save project' }).click();
await page.getByRole('status').waitFor();
await page.getByRole('button', { name: 'App', exact: true }).click();
await page.getByTitle('Private generated application preview').waitFor({ timeout: 8000 });
await shot(page, 'world-focus-1440');

state.project = null;
state.versions.length = 0;
await page.setViewportSize({ width: 720, height: 900 });
await page.goto(base, { waitUntil: 'networkidle' });
await page.getByRole('heading', { name: 'What will you create?' }).waitFor();
await shot(page, 'world-arrival-720');
await page.getByRole('button', { name: 'Design an Application' }).click();
await page.getByLabel('Tell Aethelios what you want to create').fill('A planning app for independent studios.');
await page.getByRole('radio', { name: /Create a project/i }).check();
await page.getByLabel('Tell Aethelios what you want to create').scrollIntoViewIfNeeded();
await shot(page, 'world-shape-720');
await page.getByLabel('Project name (optional)').fill('Studio planner');
await page.getByRole('button', { name: 'Create & save project' }).click();
await page.getByRole('status').waitFor();
await page.getByRole('button', { name: 'App', exact: true }).click();
await page.getByTitle('Private generated application preview').waitFor({ timeout: 8000 });
await shot(page, 'world-focus-720');

state.project = null;
state.versions.length = 0;
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(base, { waitUntil: 'networkidle' });
await page.getByRole('heading', { name: 'What will you create?' }).waitFor();
await shot(page, 'world-arrival-390');
await page.getByRole('button', { name: 'Design an Application' }).click();
await page.getByLabel('Tell Aethelios what you want to create').fill('A planning app for independent studios.');
await page.getByLabel('Tell Aethelios what you want to create').scrollIntoViewIfNeeded();
await shot(page, 'world-shape-390');

const overflow = {};
for (const width of [320, 344, 390, 720, 1440]) {
  await page.setViewportSize({ width, height: 900 });
  state.project = null;
  state.versions.length = 0;
  await page.goto(base, { waitUntil: 'networkidle' });
  overflow[width] = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
}

const receipt = {
  schema: 'architect-world-capture/v1',
  capturedAt: new Date().toISOString(),
  label: 'Local Vite fixture evidence. Not a commissioned or paid build.',
  timings,
  overflow,
};
writeFileSync(`${evidence}/world-capture.json`, `${JSON.stringify(receipt, null, 2)}\n`);
writeFileSync('test-results/architect-world-capture.json', `${JSON.stringify(receipt, null, 2)}\n`);

const video = page.video();
await context.close();
if (video) {
  const path = await video.path();
  writeFileSync(`${evidence}/world-video-path.txt`, `${path}\n`);
}
await browser.close();
console.log(JSON.stringify(receipt, null, 2));
