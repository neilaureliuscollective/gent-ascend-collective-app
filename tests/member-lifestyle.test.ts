import { describe, expect, it } from 'vitest';
import {
  memberCabinetPreview,
  memberCatalogDestinations,
  memberGroomingState,
} from '../src/domains/commerce/member-lifestyle';
import { memberLifestyleFixture } from './component-fixture/commerce';

describe('member Lifestyle destinations', () => {
  it('lists only brands and chapters present in the catalog', () => {
    const destinations = memberCatalogDestinations(memberLifestyleFixture);
    expect(destinations.brands).toEqual(['Legacy Reserve']);
    expect(destinations.flagship.map((brand) => brand.name)).toEqual(['Legacy Reserve']);
    expect(destinations.chapters.map(([id]) => id)).toEqual(['grooming', 'daily-ritual']);
  });

  it('does not invent cabinet activity or grooming insight', () => {
    expect(memberCabinetPreview([])).toEqual([]);
    expect(memberGroomingState({ available: true, records: [], ritualCount: 0 })).toEqual({
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
});
