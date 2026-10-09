import { componentUrl } from './fixtures';
import { expect, test } from './fixtures';

for (const width of [344, 768, 1440]) {
  test(`Shopify photography survives absent editorial data at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.route('https://cdn.shopify.com/fixture/*.png', (route) =>
      route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000"><rect width="800" height="1000" fill="#eeeeea"/><rect x="260" y="170" width="280" height="610" rx="32" fill="#111a16"/><rect x="260" y="350" width="280" height="260" fill="#c4912f"/><text x="400" y="480" text-anchor="middle" font-size="28">SYNTHETIC</text></svg>',
      }),
    );
    await page.goto(componentUrl('/?mode=commerce&story=missing'));
    await expect(
      page.getByRole('button', { name: /Enlarge Fixture Vitalis image 1/ }),
    ).toBeVisible();
    await expect(page.locator('.reserve-vessel, .product-atelier')).toHaveCount(0);
    await expect(page.locator('.reserve-photo-frame').first()).toHaveAttribute(
      'data-photo-active',
      'true',
    );
    expect(
      await page
        .locator('.reserve-photo-window img')
        .first()
        .evaluate((node) => getComputedStyle(node).animationPlayState),
    ).toBe('running');
    await expect(page.locator('.reserve-commerce')).toHaveAttribute(
      'data-commerce-motion',
      'active',
    );
    await page.getByRole('button', { name: 'View image 2', exact: true }).click();
    await expect(
      page.getByRole('button', { name: /Enlarge Fixture Vitalis image 2/ }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `test-results/commerce-photography-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('.reserve-commerce')).not.toHaveAttribute(
      'data-commerce-motion',
      'active',
    );
    await expect(
      page.getByRole('button', { name: /Enlarge Fixture Vitalis image 2/ }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
}

for (const width of [344, 768, 1440]) {
  test(`photographic hero keeps long captions below the frame at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('https://cdn.shopify.com/fixture/*.png', (route) =>
      route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000"><rect width="800" height="1000" fill="#12362c"/></svg>',
      }),
    );
    await page.goto(componentUrl('/?mode=commerce-showroom'));
    const hero = page.locator('.reserve-hero-object');
    await hero.scrollIntoViewIfNeeded();
    await expect(hero.locator('.reserve-photo-frame')).toBeVisible();
    const image = await hero.locator('.reserve-photo-frame').boundingBox();
    const caption = await hero.locator('.reserve-hero-object-caption').boundingBox();
    expect(caption!.y).toBeGreaterThan(image!.y + image!.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `test-results/commerce-lightbox-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
  });
}
