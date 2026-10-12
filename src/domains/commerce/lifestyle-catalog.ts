import 'server-only';
import { commerceConfigured, listCollectionProducts, ShopifyCommerceError } from './shopify';
import { brandProducts, lifestyleCollectionHandle } from './lifestyle';

export async function readLifestyleCatalog() {
  if (!commerceConfigured()) return { products: [], status: 'unconfigured' as const };
  try {
    const handle = lifestyleCollectionHandle(process.env.SHOPIFY_LEGACY_RESERVE_COLLECTION);
    const products = brandProducts(await listCollectionProducts(handle), handle);
    return { products, status: products.length ? ('ready' as const) : ('empty' as const) };
  } catch (error) {
    // Operational classification only: no token, shop identifier, GraphQL body,
    // product data or arbitrary provider message enters logs.
    console.warn('Lifestyle catalog unavailable', {
      kind: error instanceof ShopifyCommerceError ? error.kind : 'network',
      ...(error instanceof ShopifyCommerceError && error.status ? { status: error.status } : {}),
    });
    return { products: [], status: 'error' as const };
  }
}
