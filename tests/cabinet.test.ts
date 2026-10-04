import { describe, it, expect, beforeEach, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const { auth, getProduct } = vi.hoisted(() => ({ auth: vi.fn(), getProduct: vi.fn() }));
vi.mock('../src/domains/access/authorize', () => ({ authorizedPerson: auth }));
vi.mock('../src/domains/commerce/shopify', () => ({ commerceConfigured: () => true, getProduct }));
import {
  saveCatalogProduct,
  saveExternalProduct,
  updateCabinetProduct,
  removeCabinetProduct,
  reviewCabinetImport,
  importCabinetSelection,
} from '../src/domains/commerce/cabinet';
import { cabinetUpdateInput } from '../src/domains/commerce/cabinet-model';
const id = 'ce000000-0000-4000-8000-000000000001',
  person = 'ce000000-0000-4000-8000-000000000002';
let filters: unknown[], writes: unknown[], responses: { data: unknown; error: null }[];
beforeEach(() => {
  filters = [];
  writes = [];
  responses = [];
  auth.mockReset();
  getProduct.mockReset();
  const chain = {
    select: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    in: vi.fn((...args: unknown[]) => {
      filters.push(args);
      return chain;
    }),
    eq: vi.fn((...args: unknown[]) => {
      filters.push(args);
      return chain;
    }),
    update: vi.fn((input: unknown) => {
      writes.push(input);
      return chain;
    }),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn((...input: unknown[]) => {
      writes.push(input);
      return chain;
    }),
    maybeSingle: () => Promise.resolve(responses.shift()),
    then: (resolve: (r: unknown) => unknown) => Promise.resolve(responses.shift()).then(resolve),
  };
  auth.mockResolvedValue({ person: { id: person }, client: { from: () => chain } });
});
describe('member Cabinet', () => {
  it('confirms an external insertion replay against owner and original payload', async () => {
    responses.push(
      { data: null, error: null },
      { data: { name: 'My oil', category: 'beard' }, error: null },
    );
    await saveExternalProduct({ id, name: 'My oil', category: 'beard' });
    expect(filters).toEqual([
      ['person_id', person],
      ['id', id],
    ]);
    responses.push(
      { data: null, error: null },
      { data: { name: 'Different oil', category: 'beard' }, error: null },
    );
    await expect(saveExternalProduct({ id, name: 'My oil', category: 'beard' })).rejects.toThrow(
      /changed/,
    );
  });
  it('rejects anonymous mutations before catalog access', async () => {
    auth.mockResolvedValue(null);
    await expect(saveCatalogProduct({ handle: 'vitalis' })).rejects.toThrow(/Sign in/);
    expect(getProduct).not.toHaveBeenCalled();
  });
  it('does not reset an existing Vault record when saving again', async () => {
    getProduct.mockResolvedValue({
      id: 'gid://shopify/Product/1',
      handle: 'vitalis',
      title: 'Vitalis',
    });
    responses.push({ data: [{ id }], error: null });
    await saveCatalogProduct({ handle: 'vitalis' });
    expect(writes).toEqual([]);
    expect(filters).toContainEqual(['person_id', person]);
  });
  it('uses server catalog identity and conflict-safe save', async () => {
    getProduct.mockResolvedValue({
      id: 'gid://shopify/Product/1',
      handle: 'vitalis',
      title: 'Vitalis',
    });
    responses.push({ data: [], error: null }, { data: null, error: null });
    await saveCatalogProduct({ handle: 'vitalis' });
    expect(writes).toEqual([
      [
        expect.objectContaining({
          person_id: person,
          catalog_product_id: 'gid://shopify/Product/1',
          relation: 'saved',
        }),
        { onConflict: 'person_id,catalog_product_id', ignoreDuplicates: true },
      ],
    ]);
  });
  it('rejects stale edits and scopes every mutation to owner and version', async () => {
    responses.push({ data: null, error: null });
    await expect(
      updateCabinetProduct({
        id,
        version: 3,
        relation: 'in_use',
        note: 'My note',
        ritual_id: null,
      }),
    ).rejects.toThrow(/changed/);
    expect(filters).toEqual([
      ['person_id', person],
      ['id', id],
      ['version', 3],
    ]);
    responses.push({ data: { id }, error: null });
    await removeCabinetProduct({ id, version: 3 });
    expect(filters.slice(-3)).toEqual([
      ['person_id', person],
      ['id', id],
      ['version', 3],
    ]);
  });
  it('rejects an inaccessible ritual before updating the product', async () => {
    responses.push({ data: null, error: null });
    await expect(
      updateCabinetProduct({ id, version: 1, relation: 'in_use', note: '', ritual_id: id }),
    ).rejects.toThrow(/ritual/);
    expect(writes).toEqual([]);
  });
  it('cannot submit verified purchases or extra owner fields', () => {
    expect(
      cabinetUpdateInput.safeParse({
        id,
        version: 1,
        relation: 'verified_order',
        note: '',
        ritual_id: null,
      }).success,
    ).toBe(false);
    expect(
      cabinetUpdateInput.safeParse({
        id,
        version: 1,
        relation: 'owned',
        note: '',
        ritual_id: null,
        person_id: person,
      }).success,
    ).toBe(false);
  });
});

describe('reviewed browser selection import', () => {
  const product = { id: 'gid://shopify/Product/1', handle: 'vitalis', title: 'Vitalis' };
  it('requires identity for reviews and imports', async () => {
    auth.mockResolvedValue(null);
    await expect(reviewCabinetImport(['vitalis'])).rejects.toThrow(/Sign in/);
    await expect(
      importCabinetSelection({ owner: person, items: [{ handle: 'vitalis', id: product.id }] }),
    ).rejects.toThrow(/Sign in/);
    expect(getProduct).not.toHaveBeenCalled();
  });
  it('bounds review requests before catalog work and rejects duplicates', async () => {
    await expect(
      reviewCabinetImport(Array.from({ length: 21 }, (_, i) => `product-${i}`)),
    ).rejects.toThrow();
    await expect(reviewCabinetImport(['vitalis', 'vitalis'])).rejects.toThrow();
    expect(getProduct).not.toHaveBeenCalled();
  });
  it('reviews published facts and leaves unavailable previews out', async () => {
    getProduct.mockResolvedValueOnce(product).mockResolvedValueOnce(null);
    expect(await reviewCabinetImport(['vitalis', 'preview'])).toEqual({
      owner: person,
      items: [product],
      unavailable: ['preview'],
      error: '',
    });
    expect(writes).toEqual([]);
  });
  it('rejects a changed account and changed product identity without writes', async () => {
    await expect(
      importCabinetSelection({ owner: id, items: [{ handle: 'vitalis', id: product.id }] }),
    ).rejects.toThrow(/account changed/);
    expect(getProduct).not.toHaveBeenCalled();
    getProduct.mockResolvedValue({ ...product, id: 'gid://shopify/Product/2' });
    await expect(
      importCabinetSelection({ owner: person, items: [{ handle: 'vitalis', id: product.id }] }),
    ).rejects.toThrow(/collection changed/);
    expect(writes).toEqual([]);
  });
  it('preserves legacy use records and inserts remaining products in one owner-bound write', async () => {
    getProduct
      .mockResolvedValueOnce(product)
      .mockResolvedValueOnce({
        ...product,
        id: 'gid://shopify/Product/2',
        handle: 'cleanser',
        title: 'Cleanser',
      });
    responses.push(
      { data: [{ shopify_handle: 'vitalis' }], error: null },
      { data: [{ id }], error: null },
    );
    const count = await importCabinetSelection({
      owner: person,
      items: [
        { handle: 'vitalis', id: product.id },
        { handle: 'cleanser', id: 'gid://shopify/Product/2' },
      ],
    });
    expect(count).toBe(1);
    expect(filters).toContainEqual(['person_id', person]);
    expect(writes).toEqual([
      [
        [
          expect.objectContaining({
            person_id: person,
            catalog_product_id: 'gid://shopify/Product/2',
            relation: 'saved',
          }),
        ],
        { onConflict: 'person_id,catalog_product_id', ignoreDuplicates: true },
      ],
    ]);
  });
  it('replays an already imported selection without resetting records', async () => {
    getProduct.mockResolvedValue(product);
    responses.push({ data: [{ shopify_handle: 'vitalis' }], error: null });
    expect(
      await importCabinetSelection({
        owner: person,
        items: [{ handle: 'vitalis', id: product.id }],
      }),
    ).toBe(0);
    expect(writes).toEqual([]);
  });
});
