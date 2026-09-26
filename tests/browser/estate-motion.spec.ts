import { test, expect } from './fixtures';
import { writeFile } from 'node:fs/promises';

// Screenshots alone cannot expose entry/exit timing or scroll reversal regressions.
for (const width of [344, 768, 1440]) {
  test(`continuous scene choreography at ${width}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await expect(page.locator('.estate-journey')).toHaveAttribute('data-choreographed', 'true');
    const session = await page.context().newCDPSession(page);
    await session.send('Tracing.start', {
      categories: 'devtools.timeline,disabled-by-default-devtools.screenshot',
      transferMode: 'ReturnAsStream',
    });
    for (const selector of [
      '#the-ritual',
      '.estate-collection',
      '#the-intelligence',
      '#the-reserve',
    ]) {
      await page
        .locator(selector)
        .evaluate((el) =>
          scrollTo(0, scrollY + el.getBoundingClientRect().top - innerHeight * 0.65),
        );
      // Slow arrival, quicker advance and reverse: one native scroll source throughout.
      await page.evaluate(async () => {
        for (const [steps, distance] of [
          [40, 12],
          [12, 34],
          [20, -20],
        ] as const) {
          for (let i = 0; i < steps; i++) {
            scrollBy(0, distance);
            await new Promise(requestAnimationFrame);
          }
        }
      });
      const background = page
        .locator(`${selector} .atmosphere-environment, ${selector} .estate-art`)
        .first();
      if (await background.count())
        expect(await background.evaluate((el) => getComputedStyle(el).transform)).toBe('none');
    }
    const scene = page.locator('#the-intelligence');
    await scene.evaluate((el) => scrollTo(0, scrollY + el.getBoundingClientRect().top - 116));
    await expect(page.locator('.estate-sculpture .aurelius-presence')).toHaveAttribute(
      'data-state',
      'ready',
    );
    await expect(page.locator('.estate-sculpture canvas')).toHaveCount(1);
    if (width > 700) {
      const stage = scene.locator('.estate-scene-stage');
      const before = await stage.boundingBox();
      await page.evaluate(() => scrollBy(0, 300));
      await page.waitForTimeout(100);
      const after = await stage.boundingBox();
      expect(Math.abs(after!.y - before!.y)).toBeLessThan(3);
      const copy = await scene.locator('.estate-scene-copy').boundingBox();
      expect(copy!.y).toBeGreaterThanOrEqual(110);
      expect(copy!.y + copy!.height).toBeLessThan(900);
    }
    await page.screenshot({ path: testInfo.outputPath('intelligence-held.png') });
    const complete = new Promise<{ stream?: string }>((resolve) =>
      session.once('Tracing.tracingComplete', resolve),
    );
    await session.send('Tracing.end');
    const { stream } = await complete;
    if (!stream) throw new Error('Browser did not return a trace stream');
    let trace = '';
    for (;;) {
      const chunk = await session.send('IO.read', { handle: stream });
      trace += chunk.data;
      if (chunk.eof) break;
    }
    await session.send('IO.close', { handle: stream });
    await writeFile(testInfo.outputPath('continuous-scroll.json'), trace);
    await testInfo.attach('continuous-scroll-trace', {
      body: trace,
      contentType: 'application/json',
    });
    // Fold/unfold and browser viewport changes must recalculate without stale clipping.
    await page.setViewportSize({ width: width === 344 ? 768 : 344, height: 760 });
    await page.getByRole('button', { name: 'Still mode', exact: true }).click();
    await expect(page.locator('.estate-sculpture canvas')).toHaveCount(0);
    await expect(page.locator('.estate-sculpture .presence-fallback')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(errors).toEqual([]);
  });
}
