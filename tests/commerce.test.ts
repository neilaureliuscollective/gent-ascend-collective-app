import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import {
  addLine,
  createCart,
  getCart,
  listProducts,
  cartLaunchPurchasable,
  getProduct,
  listCollectionProducts,
} from '../src/domains/commerce/shopify';

const original = {
  domain: process.env.SHOPIFY_STORE_DOMAIN,
  token: process.env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN,
};
beforeEach(() => {
  process.env.SHOPIFY_STORE_DOMAIN = 'gent-ascend.myshopify.com';
  process.env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN = 'test-private-token';
});
afterEach(() => {
  vi.unstubAllGlobals();
  if (original.domain === undefined) delete process.env.SHOPIFY_STORE_DOMAIN;
  else process.env.SHOPIFY_STORE_DOMAIN = original.domain;
  if (original.token === undefined) delete process.env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN;
  else process.env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN = original.token;
});

describe('Shopify commerce contract', () => {
  it('queries the selected Shopify collection and never fabricates missing merchandise', async () => {
    const fetch = vi.fn(async (_url: string, options: RequestInit) => {
      const request = JSON.parse(String(options.body));
      expect(request.variables.handle).toBe('legacy-reserve');
      expect(request.query).toContain('collection(handle: $handle)');
      return new Response(JSON.stringify({ data: { collection: null } }));
    });
    vi.stubGlobal('fetch', fetch);
    expect(await listCollectionProducts('legacy-reserve')).toEqual([]);
  });
  it('loads additional product variants and reads current detail without shared price caching', async () => {
    const fetch = vi.fn(async (_url: string, options: RequestInit) => {
      const request = JSON.parse(String(options.body));
      expect(options.cache).toBe('no-store');
      expect(request.variables.handle).toBe('published-product');
      if (request.query.includes('ProductVariants')) {
        expect(request.variables.cursor).toBe('next-variants');
        return new Response(
          JSON.stringify({
            data: {
              product: {
                variants: {
                  nodes: [{ id: 'second' }],
                  pageInfo: { hasNextPage: false, endCursor: 'last' },
                },
              },
            },
          }),
        );
      }
      return new Response(
        JSON.stringify({
          data: {
            product: {
              requiresSellingPlan: false,
              variants: {
                nodes: [{ id: 'first' }],
                pageInfo: { hasNextPage: true, endCursor: 'next-variants' },
              },
            },
          },
        }),
      );
    });
    vi.stubGlobal('fetch', fetch);
    expect((await getProduct('published-product'))?.variants.nodes.map((v) => v.id)).toEqual([
      'first',
      'second',
    ]);
  });
  it('rejects direct purchase requests for products outside the approved merchant collection', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              data: {
                node: {
                  availableForSale: true,
                  product: {
                    collections: { nodes: [{ handle: 'unrelated', title: 'Other products' }] },
                  },
                },
              },
            }),
          ),
      ),
    );
    await expect(createCart('gid://shopify/ProductVariant/1', 1)).rejects.toThrow(
      'not open for ordering',
    );
  });
  it('passes the Shopify end cursor to subsequent catalog reads and retains older products', async () => {
    const cursors: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, options: RequestInit) => {
        const request = JSON.parse(String(options.body));
        expect(request.query).toContain('after: $cursor');
        cursors.push(request.variables.cursor);
        return new Response(
          JSON.stringify({
            data: {
              products:
                request.variables.cursor === null
                  ? {
                      nodes: [{ id: 'new-product', requiresSellingPlan: false }],
                      pageInfo: { hasNextPage: true, endCursor: 'older-page' },
                    }
                  : {
                      nodes: [
                        { id: 'older-product', requiresSellingPlan: false },
                        { id: 'unsupported-plan', requiresSellingPlan: true },
                      ],
                      pageInfo: { hasNextPage: false, endCursor: 'last' },
                    },
            },
          }),
          { status: 200 },
        );
      }),
    );
    expect((await listProducts()).map((product) => product.id)).toEqual([
      'new-product',
      'older-product',
    ]);
    expect(cursors).toEqual([null, 'older-page']);
  });
  it('queries real catalog data and excludes subscription-only products in V1', async () => {
    const fetch = vi.fn(async (...args: [string, RequestInit]) => {
      expect(args[0]).toContain('graphql.json');
      return new Response(
        JSON.stringify({
          data: {
            products: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [
                { id: 'one', requiresSellingPlan: false },
                { id: 'two', requiresSellingPlan: true },
              ],
            },
          },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal('fetch', fetch);
    expect((await listProducts()).map((entry) => entry.id)).toEqual(['one']);
    const [url, options] = fetch.mock.calls[0]!;
    expect(url).toBe('https://gent-ascend.myshopify.com/api/2026-10/graphql.json');
    expect((options.headers as Record<string, string>)['Shopify-Storefront-Private-Token']).toBe(
      'test-private-token',
    );
    expect(JSON.parse(String(options.body)).query).toContain('priceRange { minVariantPrice');
    expect(JSON.parse(String(options.body)).query).not.toContain('variants(first: 50)');
  });

  it('uses Shopify variant IDs, full cart IDs and buyer IP in cart mutations', async () => {
    const cart = {
      id: 'gid://shopify/Cart/abc?key=secret',
      checkoutUrl: 'https://gent-ascend.myshopify.com/checkouts/1',
    };
    const fetch = vi.fn(async (_url: string, options: RequestInit) => {
      const { query } = JSON.parse(String(options.body));
      return new Response(
        JSON.stringify({
          data: query.includes('PurchaseReadiness')
            ? {
                node: {
                  availableForSale: true,
                  product: {
                    requiresSellingPlan: false,
                    collections: { nodes: [{ handle: 'legacy-reserve', title: 'Legacy Reserve' }] },
                  },
                },
              }
            : query.includes('cartCreate')
              ? { cartCreate: { cart, userErrors: [] } }
              : { cartLinesAdd: { cart, userErrors: [] } },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal('fetch', fetch);
    expect((await createCart('gid://shopify/ProductVariant/1', 2, '192.0.2.1')).id).toBe(cart.id);
    await addLine(cart.id, 'gid://shopify/ProductVariant/2', 1, '192.0.2.1');
    expect(JSON.parse(String(fetch.mock.calls[3]![1].body)).variables).toEqual({
      id: cart.id,
      lines: [{ merchandiseId: 'gid://shopify/ProductVariant/2', quantity: 1 }],
    });
    expect(
      (fetch.mock.calls[3]![1].headers as Record<string, string>)['Shopify-Storefront-Buyer-IP'],
    ).toBe('192.0.2.1');
  });

  it('does not fabricate a cart on Shopify failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ data: { cart: null } }), { status: 200 })),
    );
    expect(await getCart('gid://shopify/Cart/deleted?key=secret')).toBeNull();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              data: {
                node: {
                  availableForSale: true,
                  product: {
                    collections: { nodes: [{ handle: 'legacy-reserve', title: 'Legacy Reserve' }] },
                  },
                },
                cartCreate: { cart: null, userErrors: [{ message: 'Unavailable' }] },
              },
            }),
            { status: 200 },
          ),
      ),
    );
    await expect(createCart('gid://shopify/ProductVariant/1', 1)).rejects.toThrow('Unavailable');
  });
});

describe('server launch validation', () => {
  it('rejects direct preview variant requests before any cart mutation', async () => {
    const fetch = vi.fn<(url: string, options: RequestInit) => Promise<Response>>(
      async () =>
        new Response(
          JSON.stringify({
            data: {
              node: { availableForSale: true, product: { launchState: { value: 'preorder' } } },
            },
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetch);
    await expect(createCart('gid://shopify/ProductVariant/preview', 1)).rejects.toThrow(
      'not open for ordering',
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetch.mock.calls[0]![1]?.body)).query).not.toContain('mutation');
  });
  it('rejects a cart whose previously purchasable product has become a preview', () => {
    const cart = {
      lines: { nodes: [{ merchandise: { product: { launchState: { value: 'preview' } } } }] },
    };
    expect(cartLaunchPurchasable(cart as Parameters<typeof cartLaunchPurchasable>[0])).toBe(false);
  });
});
