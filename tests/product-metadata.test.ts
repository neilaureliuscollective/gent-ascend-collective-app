import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { productMetadata } from '../src/domains/commerce/product-metadata';

describe('unverified product metadata', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('keeps noindex and does not advertise a product name in Open Graph', async () => {
    vi.stubEnv('SHOPIFY_STORE_DOMAIN', '');
    vi.stubEnv('SHOPIFY_STOREFRONT_PRIVATE_TOKEN', '');
    const meta = await productMetadata('vitalis');
    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(meta.title).toBe('Product unavailable — Aethelios Lifestyle');
    expect(meta.openGraph?.title).toBe('Product unavailable — Aethelios Lifestyle');
    expect(JSON.stringify(meta)).not.toMatch(/Vitalis/i);
  });
});
