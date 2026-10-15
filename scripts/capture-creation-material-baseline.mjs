import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import {
  installMaterialFixture,
  openMaterialTalk,
  openMaterialArchitect,
  openMaterialDocument,
  openMaterialStudio,
} from '../tests/fixtures/creation-materials.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = resolve('docs/evidence/creation-materials');
const cssRoot = process.env.MATERIAL_BASELINE_CSS_DIR || '/tmp/material-production-css';
const baseURL = process.env.MATERIAL_BASE_URL || 'http://127.0.0.1:3110';
const provenance = JSON.parse(readFileSync(root + '/served-css-audit.json', 'utf8'));
for (const name of ['inter', 'sora']) {
  const font = provenance.baselineFonts[name];
  const hash = createHash('sha256').update(readFileSync(font.source)).digest('hex');
  if (hash !== font.sha256) throw Error('Baseline font bytes differ: ' + name);
}
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ baseURL });
await installMaterialFixture(page);
await page.route('**/*.woff2', async (route) => {
  const url = route.request().url();
  const font = url.includes('inter-') ? 'inter' : url.includes('sora-') ? 'sora' : null;
  if (!font) throw Error('Unmapped baseline font: ' + url);
  await route.fulfill({
    path: resolve('src/assets/fonts/' + font + '.woff2'),
    contentType: 'font/woff2',
  });
});
const files = [];
async function capture(name, label, kind) {
  const paths = provenance[kind].styles;
  const styles = paths.map((path) => {
    const file = path.split('/').at(-1);
    let css = readFileSync(cssRoot + '/' + file, 'utf8');
    if (createHash('sha256').update(css).digest('hex') !== provenance.sha256[file])
      throw Error('Baseline stylesheet differs from the audited response: ' + file);
    css = css.replace(/url\(([^)]+)\)/g, (full, value) => {
      const raw = value.replace(/^['"]|['"]$/g, '');
      return raw.startsWith('data:') || raw.startsWith('#')
        ? full
        : `url("${new URL(raw, baseURL + path).href}")`;
    });
    return { path, css };
  });
  await page.evaluate((styles) => {
    document.querySelectorAll('style,link[rel="stylesheet"]').forEach((el) => el.remove());
    for (const item of styles) {
      const style = document.createElement('style');
      style.dataset.productionSource = item.path;
      style.textContent = item.css;
      document.head.appendChild(style);
    }
  }, styles);
  await page.evaluate(async () => {
    for (const family of ['inter', 'sora']) {
      const faces = await document.fonts.load('16px ' + family);
      if (!faces.length || !faces.every((f) => f.status === 'loaded'))
        throw Error('Baseline font failed: ' + family);
    }
    await document.fonts.ready;
    if (!document.fonts.check('16px inter') || !document.fonts.check('16px sora'))
      throw Error('Baseline fonts did not load');
  });
  const bytes = await page.screenshot({
    path: `${root}/before-${name}-${label}.png`,
    animations: 'disabled',
    fullPage: kind === 'studio',
  });
  files.push({
    path: `before-${name}-${label}.png`,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
}
for (const [label, width, height] of [
  ['phone', 390, 844],
  ['fold-narrow', 690, 884],
  ['fold-wide', 884, 690],
  ['desktop', 1440, 900],
  ['keyboard', 390, 520],
]) {
  await page.setViewportSize({ width, height });
  await openMaterialTalk(page);
  await capture('talk', label, 'talk');
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await capture('talk-document', label, 'talk');
  await openMaterialArchitect(page);
  await capture('architect-blueprint', label, 'architect');
  await openMaterialDocument(page);
  await page
    .getByLabel('Editable Markdown')
    .fill('# Field notes studio\n\nKeep this visible draft through view changes.');
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await capture('architect-document', label, 'architect');
  await openMaterialStudio(page);
  await page
    .getByRole('group', { name: 'Studio workspace views' })
    .evaluate((el) => el.classList.add('imperial-control-surface'));
  await capture('studio', label, 'studio');
}
writeFileSync(
  `${root}/before-manifest.json`,
  JSON.stringify(
    {
      kind: 'served-production-CSS-replay-with-labelled-API-fixture',
      sourceCommit: provenance.commit,
      deployment: provenance.deployment,
      fontReplay: 'Exact repository Inter/Sora bytes, verified identical to baseline Git objects',
      files,
    },
    null,
    2,
  ) + '\n',
);
const manifest = JSON.parse(readFileSync(root + '/before-manifest.json', 'utf8'));
manifest.files = manifest.files.filter((f) => f.path.startsWith('before-studio-'));
writeFileSync(root + '/studio-before-manifest.json', JSON.stringify(manifest, null, 2) + '\n');
await browser.close();
