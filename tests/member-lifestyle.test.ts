import { describe, expect, it } from 'vitest';
import {
  memberCabinetPreview,
  memberCatalogDestinations,
  memberGroomingState,
} from '../src/domains/commerce/member-lifestyle';
import { memberLifestyleFixture } from './component-fixture/commerce';

describe('member Lifestyle destinations', () => {
  it('lists only chapters and vendor names present in the catalog', () => {
    const destinations = memberCatalogDestinations(memberLifestyleFixture);
    expect(destinations.brands).toEqual(['Aethelios Lifestyle']);
    expect(destinations.chapters.map(([id]) => id)).toEqual(['grooming', 'daily-ritual']);
  });

  it('does not invent cabinet activity or grooming insight', () => {
    expect(memberCabinetPreview([])).toEqual([]);
    expect(
      memberGroomingState({ available: true, records: [], ritualCount: 0, keptCount: 0 }),
    ).toEqual({
      ritualCount: 0,
      kept: 0,
      ready: true,
    });
    expect(
      memberCabinetPreview([
        {
          id: 'ce000000-0000-4000-8000-000000000001',
          name: 'Synthetic Cabinet oil',
          relation: 'owned',
          shopify_handle: 'fixture-oil',
        },
      ])[0],
    ).toMatchObject({ label: 'Owned', name: 'Synthetic Cabinet oil' });
  });

  it('uses the kept count rather than the preview page length', () => {
    expect(
      memberGroomingState({
        available: true,
        ritualCount: 1,
        keptCount: 5,
        records: [
          {
            id: 'ce000000-0000-4000-8000-000000000001',
            name: 'Synthetic Cabinet oil',
            relation: 'owned',
            shopify_handle: 'fixture-oil',
          },
        ],
      }),
    ).toEqual({ ritualCount: 1, kept: 5, ready: true });
  });
});
