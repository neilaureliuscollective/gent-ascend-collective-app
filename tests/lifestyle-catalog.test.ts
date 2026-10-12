import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ configured: vi.fn(), products: vi.fn(), collection: vi.fn() }));
vi.mock('../src/domains/commerce/shopify', () => {
  class ShopifyCommerceError extends Error {}
  class CollectionUnavailableError extends ShopifyCommerceError {}
  return {
    commerceConfigured: mocks.configured,
    listProducts: mocks.products,
    listCollectionProducts: mocks.collection,
    ShopifyCommerceError,
    CollectionUnavailableError,
  };
});
import {
  readLifestyleCatalog,
  readLegacyReserveCatalog,
} from '../src/domains/commerce/lifestyle-catalog';
import { CollectionUnavailableError } from '../src/domains/commerce/shopify';
import {
  catalogProductAllowed,
  lifestyleAssortmentHandle,
} from '../src/domains/commerce/lifestyle';
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('SHOPIFY_LIFESTYLE_COLLECTION', '');
  vi.stubEnv('SHOPIFY_LEGACY_RESERVE_COLLECTION', '');
  mocks.configured.mockReturnValue(true);
  mocks.products.mockResolvedValue([{ id: 'published', collections: { nodes: [] } }]);
  mocks.collection.mockResolvedValue([]);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
describe('Headless published catalog scope', () => {
  it('loads published products without requiring an invented brand collection', async () => {
    const result = await readLifestyleCatalog();
    expect(result.status).toBe('ready');
    expect(result.products).toHaveLength(1);
    expect(mocks.products).toHaveBeenCalledOnce();
    expect(mocks.collection).not.toHaveBeenCalled();
    expect(catalogProductAllowed({ collections: { nodes: [] } }, lifestyleAssortmentHandle())).toBe(
      true,
    );
  });
  it('keeps an explicit whole-store restriction and never broadens missing collections', async () => {
    vi.stubEnv('SHOPIFY_LIFESTYLE_COLLECTION', 'approved');
    mocks.collection.mockRejectedValue(new CollectionUnavailableError());
    expect((await readLifestyleCatalog()).status).toBe('error');
    expect(mocks.collection).toHaveBeenCalledWith('approved');
    expect(mocks.products).not.toHaveBeenCalled();
    expect(catalogProductAllowed({ collections: { nodes: [] } }, 'approved')).toBe(false);
  });
  it('distinguishes a genuinely empty published catalog from provider failure', async () => {
    mocks.products.mockResolvedValue([]);
    expect((await readLifestyleCatalog()).status).toBe('empty');
    mocks.products.mockRejectedValue(new Error('do not disclose provider secret'));
    expect((await readLifestyleCatalog()).status).toBe('error');
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain('provider secret');
  });
  it('does not relabel the whole store as Legacy Reserve when that brand is missing', async () => {
    mocks.collection.mockRejectedValue(new CollectionUnavailableError());
    expect((await readLegacyReserveCatalog()).status).toBe('empty');
    expect(mocks.collection).toHaveBeenCalledWith('legacy-reserve');
    expect(mocks.products).not.toHaveBeenCalled();
  });
  it('keeps both catalogs closed when credentials are absent and rejects invalid restrictions', async () => {
    mocks.configured.mockReturnValue(false);
    expect((await readLifestyleCatalog()).status).toBe('unconfigured');
    expect((await readLegacyReserveCatalog()).status).toBe('unconfigured');
    expect(mocks.products).not.toHaveBeenCalled();
    expect(() => lifestyleAssortmentHandle('bad/handle')).toThrow();
  });
});
