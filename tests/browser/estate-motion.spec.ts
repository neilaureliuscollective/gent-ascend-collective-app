import { test, expect } from './fixtures';

for (const width of [344, 768, 1440]) {
  test(`the first acts visibly transform with scroll at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 344 ? 740 : 900 });
    await page.goto('/');
    const threshold = page.locator('.ascend-threshold');
    await expect(page.locator('.estate-journey')).toHaveAttribute('data-choreographed', 'true');
    const sample = async (selector: string, progress: number) => {
      await page.evaluate(({ progress, selector }) => {
        const scene = document.querySelector(selector)!;
        scrollTo({
          top: scene.getBoundingClientRect().top + scrollY +
            (scene.clientHeight - innerHeight) * progress,
          behavior: 'instant',
        });
      }, { selector, progress });
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    };
    await sample('.ascend-threshold', 0.1);
    const early = await threshold.locator('.ascend-threshold-mark').evaluate((el) => Number(getComputedStyle(el).opacity));
    const firstScale = await threshold.locator('.ascend-threshold-environment').evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).a);
    await sample('.ascend-threshold', 0.5);
    await expect.poll(() => threshold.locator('.ascend-threshold-mark').evaluate((el) => Number(getComputedStyle(el).opacity))).toBeGreaterThan(early + 0.4);
    await sample('.ascend-threshold', 0.88);
    await expect.poll(() => threshold.locator('.ascend-threshold-mark').evaluate((el) => Number(getComputedStyle(el).opacity))).toBeLessThan(0.2);
    await expect.poll(() => threshold.locator('.ascend-threshold-environment').evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).a)).toBeGreaterThan(firstScale + 0.3);
    const inset = await page.locator('.ascend-threshold-stage').evaluate((el) => Math.round(el.getBoundingClientRect().top));
    expect(inset).toBeGreaterThanOrEqual(70);
    expect(inset).toBeLessThan(140);
    await sample('.ascend-man', 0.1);
    const first = await page.locator('.ascend-man-choice').evaluate((el) => Number(getComputedStyle(el).opacity));
    const firstPortrait = await page.locator('.ascend-man-portrait').evaluate((el) => Number(getComputedStyle(el).opacity));
    await sample('.ascend-man', 0.52);
    await expect.poll(() => page.locator('.ascend-man-portrait').evaluate((el) => Number(getComputedStyle(el).opacity))).toBeGreaterThan(firstPortrait + 0.5);
    const middleDecision = await page.locator('.ascend-man-decision').evaluate((el) => Number(getComputedStyle(el).opacity));
    await sample('.ascend-man', 0.85);
    await expect.poll(() => page.locator('.ascend-man-choice').evaluate((el) => Number(getComputedStyle(el).opacity))).toBeGreaterThan(first + 0.5);
    await expect.poll(() => page.locator('.ascend-man-decision').evaluate((el) => Number(getComputedStyle(el).opacity))).toBeGreaterThan(middleDecision + 0.5);
    await sample('.ascend-emergence', 0.12);
    const orb = await page.locator('.ascend-emergence .estate-sculpture').evaluate((el) => Number(getComputedStyle(el).opacity));
    await sample('.ascend-emergence', 0.8);
    await expect.poll(() => page.locator('.ascend-emergence .estate-sculpture').evaluate((el) => Number(getComputedStyle(el).opacity))).toBeGreaterThan(orb + 0.4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test(`LifeOS copy and exits keep separate space at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 344 ? 740 : 900 });
    await page.goto('/#the-system');
    const system = page.locator('#the-system');
    await expect(system).toHaveAttribute('data-directed', 'true');
    const boxes = await system.evaluate((element) => {
      const rect = (selector: string) => element.querySelector(selector)!.getBoundingClientRect();
      return {
        story: rect('.life-system-story').bottom,
        disclosureTop: rect('.life-system-disclosure').top,
        disclosureBottom: rect('.life-system-disclosure').bottom,
        actionsTop: rect('.estate-actions').top,
        actionsBottom: rect('.estate-actions').bottom,
        railTop: rect('.life-system-stages').top,
      };
    });
    expect(boxes.story).toBeLessThanOrEqual(boxes.disclosureTop + 4);
    expect(boxes.disclosureBottom).toBeLessThanOrEqual(boxes.actionsTop + 1);
    if (width <= 900) expect(boxes.actionsBottom).toBeLessThanOrEqual(boxes.railTop + 1);
  });

  test(`native scroll and Fold-width changes preserve the entry at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await expect(page.locator('.estate-journey')).toHaveAttribute('data-choreographed', 'true');
    for (const selector of ['#the-man', '#the-intelligence', '#the-system', '#the-ritual']) {
      await page.locator(selector).scrollIntoViewIfNeeded();
      await expect(page.locator(selector)).toBeVisible();
      await page.evaluate(() => scrollBy(0, 180));
      await page.evaluate(() => scrollBy(0, -120));
    }
    await page.locator('#the-intelligence').scrollIntoViewIfNeeded();
    await expect(page.locator('.estate-sculpture .aurelius-presence')).toHaveAttribute(
      'data-state',
      'ready',
    );
    await expect(page.locator('.estate-sculpture canvas')).toHaveCount(1);
    await page.setViewportSize({ width: width === 344 ? 768 : 344, height: 760 });
    await page.getByRole('button', { name: 'Still mode', exact: true }).click();
    await expect(page.locator('.estate-sculpture canvas')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(errors).toEqual([]);
  });
}
