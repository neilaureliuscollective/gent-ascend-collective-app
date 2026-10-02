import { describe, expect, it, vi } from 'vitest';
import { collectCatalog } from '../src/domains/commerce/catalog-pagination';
import { filterCatalog } from '../src/domains/commerce/catalog-filter';
import { collectionEntries } from '../src/domains/commerce/collection';

describe('bounded complete catalog', () => {
  it('follows Shopify cursors beyond 60 products and deduplicates IDs', async () => {
    const load = vi.fn(async (cursor: string | null) =>
      cursor === null
        ? {
            nodes: Array.from({ length: 60 }, (_, i) => ({ id: String(i) })),
            pageInfo: { hasNextPage: true, endCursor: 'next' },
          }
        : {
            nodes: [{ id: '59' }, { id: 'older-saved-item' }],
            pageInfo: { hasNextPage: false, endCursor: 'last' },
          },
    );
    const result = await collectCatalog(load);
    expect(result).toHaveLength(61);
    expect(result.at(-1)?.id).toBe('older-saved-item');
    expect(load.mock.calls.map((call) => call[0])).toEqual([null, 'next']);
  });
  it('rejects missing, repeated or empty advancing cursors', async () => {
    for (const cursor of [null, '']) {
      await expect(
        collectCatalog(async () => ({
          nodes: [{ id: 'a' }],
          pageInfo: { hasNextPage: true, endCursor: cursor },
        })),
      ).rejects.toThrow('did not advance');
    }
    await expect(
      collectCatalog(async () => ({
        nodes: [{ id: 'a' }],
        pageInfo: { hasNextPage: true, endCursor: 'repeat' },
      })),
    ).rejects.toThrow('did not advance');
    await expect(
      collectCatalog(async () => ({
        nodes: [],
        pageInfo: { hasNextPage: true, endCursor: 'next' },
      })),
    ).rejects.toThrow('did not advance');
  });
  it('fails on a later-page error and on a catalog exceeding the page budget', async () => {
    await expect(
      collectCatalog(async (cursor) => {
        if (cursor) throw new Error('Later page unavailable');
        return { nodes: [{ id: 'a' }], pageInfo: { hasNextPage: true, endCursor: 'next' } };
      }),
    ).rejects.toThrow('Later page unavailable');
    let page = 0;
    await expect(
      collectCatalog(async () => ({
        nodes: [{ id: String(++page) }],
        pageInfo: { hasNextPage: true, endCursor: String(page) },
      })),
    ).rejects.toThrow('supported collection size');
    expect(page).toBe(10);
  });
});

it('searches public product language while preserving release eligibility', () => {
  const previews = collectionEntries([], true);
  expect(filterCatalog(previews, '  VITALIS beard  ', false).map((entry) => entry.handle)).toEqual([
    'vitalis',
  ]);
  expect(filterCatalog(previews, '', true)).toEqual([]);
  expect(filterCatalog(previews, 'not-in-the-catalog', false)).toEqual([]);
  expect(filterCatalog(previews, '', false)).toHaveLength(4);
  expect(
    filterCatalog([{ ...previews[0]!, orderable: true }, ...previews.slice(1)], '', true),
  ).toHaveLength(1);
});
