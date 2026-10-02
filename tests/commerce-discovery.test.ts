import { parseSavedSelection } from '../src/domains/commerce/saved-selection';
import { describe, expect, it } from 'vitest';
import {
  discoverCollection,
  discoveryReason,
  resolveRelated,
} from '../src/domains/commerce/discovery';
import { readProductStory } from '../src/domains/commerce/product-story';
import { collectionEntries } from '../src/domains/commerce/collection';
import type { ProductSummary } from '../src/domains/commerce/shopify';

function product(handle: string, state: string, available = true, story?: unknown): ProductSummary {
  return {
    id: `gid://shopify/Product/${handle}`,
    handle,
    title: handle,
    productType: 'Beard oil',
    featuredImage: null,
    collections: { nodes: [{ handle: 'grooming', title: 'Legacy Reserve' }] },
    availableForSale: available,
    requiresSellingPlan: false,
    launchState: { value: state },
    story: story ? { value: JSON.stringify(story) } : null,
    priceRange: { minVariantPrice: { amount: '24.00', currencyCode: 'USD' } },
  };
}
const approved = { version: 1, status: 'approved', discovery: ['beard'] };
describe('transparent collection discovery', () => {
  it('keeps ready filters dependent on server-derived launch and stock status', () => {
    const entries = collectionEntries([
      product('ready', 'ready', true, approved),
      product('sold-out', 'ready', false, approved),
      product('preorder', 'preorder', true, approved),
      product('preview', 'preview', true, approved),
      { ...product('selling-plan', 'ready', true, approved), requiresSellingPlan: true },
    ]);
    expect(discoverCollection(entries, 'beard', 'ready').map((entry) => entry.handle)).toEqual([
      'ready',
    ]);
    expect(discoverCollection(entries, 'beard', 'all')).toHaveLength(5);
  });
  it('never infers precise fit from names or draft metadata and excludes wrong chapters', () => {
    const entries = collectionEntries([
      product('beard-word-in-title', 'ready'),
      product('draft', 'ready', true, { ...approved, status: 'draft' }),
      product('approved', 'ready', true, approved),
    ]);
    expect(discoverCollection(entries, 'beard', 'all').map((entry) => entry.handle)).toEqual([
      'approved',
    ]);
    expect(discoverCollection(entries, 'body', 'all')).toEqual([]);
    expect(discoverCollection(entries, 'all', 'all')).toHaveLength(3);
  });
  it('discloses editorial previews and never makes them ready to order', () => {
    const entries = collectionEntries([], true);
    const beard = discoverCollection(entries, 'beard', 'all');
    expect(beard.map((entry) => entry.handle)).toEqual(['vitalis']);
    expect(discoveryReason(beard[0]!, 'beard')).toContain('Final product fit');
    expect(discoverCollection(entries, 'all', 'ready')).toEqual([]);
  });
  it('resolves only approved published relations, deduplicating self, missing and repeated handles', () => {
    const entries = collectionEntries([
      product('current', 'ready'),
      product('balm', 'ready'),
      product('wash', 'preview'),
    ]);
    const story = readProductStory({
      value: JSON.stringify({
        ...approved,
        related: [
          { handle: 'current', kind: 'alternative', reason: 'Self' },
          { handle: 'balm', kind: 'alternative', reason: 'Approved reason' },
          { handle: 'balm', kind: 'complementary', reason: 'Duplicate' },
          { handle: 'missing', kind: 'complementary', reason: 'Missing' },
        ],
      }),
    });
    expect(
      resolveRelated(story, 'current', entries).map((item) => [
        item.entry.handle,
        item.kind,
        item.reason,
      ]),
    ).toEqual([['balm', 'alternative', 'Approved reason']]);
    expect(resolveRelated(null, 'current', entries)).toEqual([]);
    const preview = readProductStory({
      value: JSON.stringify({
        ...approved,
        related: [{ handle: 'wash', kind: 'complementary', reason: 'Preview' }],
      }),
    });
    expect(resolveRelated(preview, 'current', entries)[0]?.entry.orderable).toBe(false);
  });
  it('rejects unsafe relationships and health-oriented discovery inputs', () => {
    for (const extra of [
      { discovery: ['treat-eczema'] },
      { related: [{ handle: 'https://evil.test', kind: 'alternative', reason: 'Unsafe' }] },
      { related: [{ handle: 'balm', kind: 'clinically-recommended', reason: 'Unsafe' }] },
      {
        related: Array.from({ length: 5 }, () => ({
          handle: 'balm',
          kind: 'alternative',
          reason: 'Too many',
        })),
      },
      { related: [{ handle: 'balm', kind: 'alternative', reason: 'Bounded', discount: 50 }] },
    ])
      expect(readProductStory({ value: JSON.stringify({ ...approved, ...extra }) })).toBeNull();
  });
});

it('normalizes a bounded saved selection and rejects corrupt or oversized values', () => {
  expect(
    parseSavedSelection(
      JSON.stringify(['vitalis', 'vitalis', 'bad/<handle>', null, 42, 'hair-care']),
    ),
  ).toEqual(['vitalis', 'hair-care']);
  for (const raw of [null, '{bad', '{}', 'x'.repeat(20001)])
    expect(parseSavedSelection(raw)).toEqual([]);
  expect(
    parseSavedSelection(JSON.stringify(Array.from({ length: 150 }, (_, i) => `product-${i}`))),
  ).toHaveLength(100);
});
