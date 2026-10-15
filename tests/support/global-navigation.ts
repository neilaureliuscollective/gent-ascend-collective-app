import { expect, type Page } from '@playwright/test';

/** Global navigation is separate from primary shortcuts and contextual tool sheets. */
export function globalMenu(page: Page) {
  return page.getByRole('dialog', { name: 'Aethelios menu', exact: true });
}
export async function openGlobalMenu(page: Page) {
  await page.locator('.global-navigation').getByRole('button', { name: 'Menu', exact: true }).click();
  const menu = globalMenu(page);
  await expect(menu).toBeVisible();
  return menu;
}
export function globalDestinations(page: Page) {
  return globalMenu(page).getByRole('navigation', { name: 'Global navigation', exact: true });
}
