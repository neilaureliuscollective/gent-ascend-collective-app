import { test, expect } from './fixtures';
const id = '10000000-0000-4000-8000-000000000001',
  company = '10000000-0000-4000-8000-000000000002';
for (const width of [360, 768, 1440])
  test(`connected schedule and website proposals preserve consent at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const asks: unknown[] = [],
      proposals: unknown[] = [];
    await page.route('**/api/companies', (r) =>
      r.fulfill({ json: { companies: [{ id: company, name: 'Synthetic company' }] } }),
    );
    await page.route('**/api/business-connections', (r) =>
      r.fulfill({
        json: {
          enabled: true,
          connections: [
            {
              id,
              company_id: company,
              status: 'active',
              provider_id: 'katie',
              provider_name: 'Synthetic professional',
              timezone: 'America/Chicago',
              grant_expires_at: '2099-01-01T00:00:00Z',
              permissions: ['bookings.read', 'website.read', 'website.propose'],
            },
          ],
        },
      }),
    );
    await page.route('**/api/business-connections/schedule?*', (r) =>
      r.fulfill({
        json: {
          schedule: {
            source: 'Legacy Reserve',
            version: 1,
            date: '2026-10-10',
            days: 1,
            page: 0,
            hasMore: false,
            fetchedAt: '2026-10-10T15:00:00Z',
            appointments: [],
            providerId: 'katie',
            timezone: 'America/Chicago',
          },
        },
      }),
    );
    await page.route('**/api/business-connections/ask', (r) => {
      asks.push(r.request().postDataJSON());
      return r.fulfill({
        contentType: 'application/x-ndjson',
        body: '{"type":"delta","text":"Synthetic draft"}\n{"type":"saved","turn":{}}\n',
      });
    });
    const source = {
      websiteId: 'fix-it-shop',
      revision: 1,
      content: { headline: 'Synthetic original', about: 'Original wording' },
      services: [
        {
          id: 'service',
          name: 'Synthetic service',
          description: 'Original service description',
          revision: 1,
        },
      ],
      proposals: [],
      fetchedAt: '2026-10-10T15:00:00Z',
    };
    await page.route('**/api/business-connections/website*', (r) => {
      if (r.request().method() === 'POST') {
        proposals.push(r.request().postDataJSON());
        return r.fulfill({ json: { id, state: 'review' } });
      }
      return r.fulfill({ json: { source } });
    });
    await page.goto('http://127.0.0.1:3102/?mode=business-connections');
    await page.getByRole('button', { name: 'View schedule' }).click();
    await page.getByRole('button', { name: 'Refresh schedule' }).click();
    await page.getByLabel('Ask Aethelios', { exact: true }).fill('Review this schedule');
    const ask = page.getByRole('button', { name: 'Review with Aethelios' });
    await expect(ask).toBeDisabled();
    expect(asks).toHaveLength(0);
    const consent = page.getByRole('checkbox', { name: /Allow a fresh schedule page/ });
    await consent.focus();
    await page.keyboard.press('Space');
    await ask.click();
    await expect(
      page.getByText('Reply saved in your company room.', { exact: true }),
    ).toBeVisible();
    expect(asks).toHaveLength(1);
    expect(asks[0]).toMatchObject({ connectionId: id, consent: true });
    expect(asks[0]).not.toHaveProperty('includeContext');
    expect(asks[0]).not.toHaveProperty('companyId');
    await page.getByRole('button', { name: 'Load current website copy' }).click();
    await page.getByLabel('Headline', { exact: true }).fill('Proposed wording');
    expect(proposals).toHaveLength(0);
    await page.getByRole('button', { name: 'Save proposal for approval' }).click();
    await expect(
      page.getByText(/Proposal saved for review. Public website unchanged/),
    ).toBeVisible();
    expect(proposals[0]).toMatchObject({
      baseRevision: 1,
      content: { headline: 'Proposed wording', about: 'Original wording' },
      serviceChanges: [],
    });
    expect(proposals[0]).not.toHaveProperty('publish');
    await expect(page.getByRole('button', { name: 'Prepare website wording' })).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `test-results/business-connections-${width}.png`,
      fullPage: true,
    });
  });
test('uncertain website write locks editing and resubmission until receipts are checked', async ({
  page,
}) => {
  await page.route('**/api/companies', (r) => r.fulfill({ json: { companies: [] } }));
  await page.route('**/api/business-connections', (r) =>
    r.fulfill({
      json: {
        enabled: true,
        connections: [
          {
            id,
            company_id: company,
            status: 'active',
            provider_name: 'Synthetic',
            timezone: 'America/Chicago',
            permissions: ['website.read'],
          },
        ],
      },
    }),
  );
  await page.route('**/api/business-connections/website*', (r) =>
    r.request().method() === 'POST'
      ? r.fulfill({ status: 503, json: { error: 'Synthetic save unconfirmed' } })
      : r.fulfill({
          json: {
            source: {
              websiteId: 'fix-it-shop',
              revision: 1,
              content: { headline: 'Synthetic', about: 'Original' },
              services: [],
              proposals: [],
              fetchedAt: '2026-10-10T15:00:00Z',
            },
          },
        }),
  );
  await page.goto('http://127.0.0.1:3102/?mode=business-connections');
  await page.getByRole('button', { name: 'View schedule' }).click();
  await page.getByRole('button', { name: 'Load current website copy' }).click();
  await page.getByRole('button', { name: 'Save proposal for approval' }).click();
  await expect(page.getByRole('alert')).toHaveText('Synthetic save unconfirmed');
  await expect(page.getByLabel('Headline', { exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Save proposal for approval' })).toBeDisabled();
});
test('failed OAuth return is shown in the workspace without exposing provider details', async ({
  page,
}) => {
  await page.route('**/api/companies', (r) => r.fulfill({ json: { companies: [] } }));
  await page.route('**/api/business-connections', (r) =>
    r.fulfill({ json: { enabled: true, connections: [] } }),
  );
  await page.goto('http://127.0.0.1:3102/?mode=business-connections&connection=failed');
  await expect(page.getByRole('alert')).toHaveText(
    'The connection did not finish. Start again with your confirmed accounts.',
  );
});
