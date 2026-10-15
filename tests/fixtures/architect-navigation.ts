import type { Page } from '@playwright/test';

/** Open the native document disclosure before interacting with its select control. */
export async function selectArchitectDocument(page: Page, id: string) {
  const library = page.locator('details.origin-document-library');
  if ((await library.getAttribute('open')) === null)
    await library.locator(':scope > summary').click();
  await page.getByRole('combobox', { name: 'Selected document', exact: true }).selectOption(id);
}
