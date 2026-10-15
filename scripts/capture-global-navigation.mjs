// Local synthetic fixtures only. For before evidence, serve the same fixture adapter from main.
import { chromium } from 'playwright';
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ serviceWorkers: 'block' });
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.route('**/api/aurelius**', (r) =>
  r.fulfill({
    json: {
      ownerId: 'synthetic',
      conversations: [],
      turns: [],
      memories: [],
      actionProposals: [],
      context: { profile: null, goal: null, memories: [] },
      canChat: true,
      configured: true,
      model: 'fixture',
    },
  }),
);
page.on('pageerror', (e) => console.log(e.message));
for (const width of [390, 720, 1440]) {
  await page.setViewportSize({ width, height: 900 });
  for (const route of ['/app', '/app/aethelios', '/app/architect']) {
    await page.goto(
      (process.env.NAVIGATION_FIXTURE_URL || 'http://127.0.0.1:3103') +
        '/global-navigation.html?identity=founder&route=' +
        route,
    );
    await page.waitForTimeout(1500);
    await page.screenshot({
      path:
        'docs/evidence/global-navigation/' +
        (process.env.NAVIGATION_EVIDENCE_LABEL || 'before') +
        '-' +
        route.split('/').at(-1) +
        '-' +
        width +
        '.png',
    });
  }
}
await browser.close();
