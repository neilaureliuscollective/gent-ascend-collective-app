import { test, expect } from './fixtures';

for (const width of [344, 768, 1440]) {
  test(`Ascend entry keeps the story and direct exits usable at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'A life is built from the inside.' }),
    ).toBeVisible();
    for (const name of [
      'One man. Many demands.',
      'A clearer way to see the whole.',
      'Direction becomes daily practice.',
      'A moment to take your place.',
    ])
      await expect(page.getByRole('heading', { name })).toHaveCount(1);
    await expect(page.locator('.ascend-man-image img')).toHaveJSProperty('complete', true);
    await page
      .getByRole('navigation', { name: 'Explore the world' })
      .getByRole('link', { name: /The system/ })
      .click();
    await expect(page).toHaveURL(/#the-system$/);
    await expect(page.locator('.life-system-stages li')).toHaveCount(6);
    await page.getByRole('button', { name: '03 What should I do?' }).click();
    await expect(page.getByRole('heading', { name: 'Make the next move concrete.' })).toBeVisible();
    await expect(page.getByRole('button', { name: '03 What should I do?' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByText('An illustrative day · no personal data shown')).toBeVisible();
    await expect(page.getByRole('link', { name: /Explore the OS/ }).first()).toHaveAttribute(
      'href',
      '/gent-ascend',
    );
    await expect(page.getByRole('link', { name: /Explore products/ }).first()).toHaveAttribute(
      'href',
      '/shop',
    );
    await page.getByRole('button', { name: 'Still mode', exact: true }).click();
    await expect(page.locator('.estate-journey')).toHaveAttribute('data-still', 'true');
    await page.locator('#the-intelligence').scrollIntoViewIfNeeded();
    await expect(page.locator('.estate-sculpture canvas')).toHaveCount(0);
    await expect(page.locator('.estate-sculpture .presence-fallback')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.locator('#the-ritual').scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: /05.*Hydros/ }).click();
    await expect(page.getByRole('heading', { name: 'Hydros', exact: true })).toBeVisible();
    await expect(page.getByText('Preview only. Not available to order.')).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('reduced motion retains the complete sequence and destinations', async ({ page }) => {
  await page.setViewportSize({ width: 344, height: 660 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Reduced motion' })).toBeDisabled();
  await expect(page.locator('.ascend-man-resolution')).toBeVisible();
  await page.locator('#the-intelligence').scrollIntoViewIfNeeded();
  await expect(page.locator('.estate-sculpture canvas')).toHaveCount(0);
  await page.locator('#the-system').scrollIntoViewIfNeeded();
  await expect(page.locator('.life-system-stages li')).toHaveCount(6);
  await page.getByRole('button', { name: /Next stage/ }).click();
  await expect(page.getByRole('heading', { name: 'Choose what deserves a place.' })).toBeVisible();
  await page.locator('#the-legacy').scrollIntoViewIfNeeded();
  await expect(
    page.getByRole('heading', { name: 'For the life you build. And the people in it.' }),
  ).toBeVisible();
});

test('desktop LifeOS stages advance and reverse with native scroll', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#the-system');
  const system = page.locator('#the-system');
  await expect(system).toHaveAttribute('data-active', '1');
  await page.evaluate(() => {
    const section = document.querySelector('#the-system')!;
    const top = section.getBoundingClientRect().top + scrollY;
    scrollTo({ top: top + section.clientHeight * 0.43, behavior: 'instant' });
  });
  await expect(system).toHaveAttribute('data-active', '4');
  await expect(page.getByRole('heading', { name: 'Record what actually happened.' })).toBeVisible();
  await page.evaluate(() => {
    const section = document.querySelector('#the-system')!;
    scrollTo({ top: section.getBoundingClientRect().top + scrollY + 5, behavior: 'instant' });
  });
  await expect(system).toHaveAttribute('data-active', '1');
});

test('desktop ritual moves from preparation to the object and back', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#the-ritual');
  const ritual = page.locator('#the-ritual');
  await expect(ritual).toHaveAttribute('data-directed', 'true');
  await expect(ritual).toHaveAttribute('data-active', '1');
  await page.evaluate(() => {
    const section = document.querySelector('#the-ritual')!;
    scrollTo({
      top: section.getBoundingClientRect().top + scrollY + section.clientHeight * 0.38,
      behavior: 'instant',
    });
  });
  await expect(ritual).toHaveAttribute('data-active', '2');
  await expect(
    page.getByRole('heading', { name: 'Care becomes something you carry.' }),
  ).toBeVisible();
  await expect(
    page.locator('#ritual-object').getByRole('link', { name: /Inspect Vitalis/ }),
  ).toHaveAttribute('href', '/shop/vitalis#atelier');
  await page.evaluate(() => {
    const section = document.querySelector('#the-ritual')!;
    scrollTo({ top: section.getBoundingClientRect().top + scrollY + 5, behavior: 'instant' });
  });
  await expect(ritual).toHaveAttribute('data-active', '1');
});

for (const width of [344, 768]) {
  test(`Fold-width ${width} ritual keeps both moments readable`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 344 ? 660 : 900 });
    if (width === 344) await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/#the-ritual');
    await expect(page.locator('#the-ritual')).toHaveAttribute(
      'data-directed',
      width === 344 ? 'false' : 'true',
    );
    await expect(page.getByRole('heading', { name: 'A moment to take your place.' })).toBeVisible();
    if (width === 344) await page.locator('#ritual-object').scrollIntoViewIfNeeded();
    else await page.evaluate(() => {
      const section = document.querySelector('#the-ritual')!;
      scrollTo({ top: section.getBoundingClientRect().top + scrollY + section.clientHeight * 0.4, behavior: 'instant' });
    });
    await expect(
      page.getByRole('heading', { name: 'Care becomes something you carry.' }),
    ).toBeVisible();
    await page
      .locator('#ritual-object')
      .getByRole('link', { name: /Inspect Vitalis/ })
      .click();
    await expect(page).toHaveURL('/shop/vitalis#atelier');
    await expect(page.getByRole('button', { name: /Explore in 3D/ })).toBeVisible();
  });
}

for (const width of [344, 768, 1440]) {
  test(`physical world and final door stay usable at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 344 ? 660 : 900 });
    await page.goto('/#the-reserve');
    await expect(
      page.getByRole('heading', { name: 'A place where care has a face.' }),
    ).toBeVisible();
    await expect(page.locator('.reserve-world-environment img')).not.toHaveJSProperty(
      'naturalWidth',
      0,
    );
    await expect(page.locator('.reserve-world-craft img')).not.toHaveJSProperty('naturalWidth', 0);
    await expect(
      page.locator('#the-reserve').getByRole('link', { name: /Discover The Reserve/ }),
    ).toHaveAttribute('href', '/reserve');
    await page
      .getByRole('navigation', { name: 'Explore the world' })
      .getByRole('link', { name: /The Collective/ })
      .click();
    await expect(page).toHaveURL(/#the-collective$/);
    await expect(
      page.getByRole('heading', { name: 'The work extends beyond one man.' }),
    ).toBeVisible();
    await expect(page.locator('.collective-world-image')).not.toHaveJSProperty('naturalWidth', 0);
    await expect(
      page.locator('#the-collective').getByRole('link', { name: /Membership/ }),
    ).toHaveAttribute('href', '/membership');
    await page.locator('.estate-invitation').scrollIntoViewIfNeeded();
    await expect(page.getByRole('heading', { name: 'Enter Gent Ascend.' })).toBeVisible();
    await expect(
      page.locator('.estate-invitation').getByRole('link', { name: /Enter Gent Ascend/ }),
    ).toHaveAttribute('href', '/enter');
    await expect(
      page.locator('.estate-invitation').getByRole('link', { name: /Explore the collection/ }),
    ).toHaveAttribute('href', '/shop');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
