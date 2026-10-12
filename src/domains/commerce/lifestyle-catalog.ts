import 'server-only';
import {
  commerceConfigured,
  listProducts,
  listCollectionProducts,
  ShopifyCommerceError,
  CollectionUnavailableError,
} from './shopify';
import {
  lifestyleAssortmentHandle,
  lifestyleCollectionHandle,
  catalogProductAllowed,
} from './lifestyle';

function failedCatalog(error: unknown) {
  console.warn('Lifestyle catalog unavailable', {
    kind: error instanceof ShopifyCommerceError ? error.kind : 'network',
    ...(error instanceof ShopifyCommerceError && error.status ? { status: error.status } : {}),
  });
  return { products: [], status: 'error' as const };
}

export async function readLifestyleCatalog() {
  if (!commerceConfigured()) return { products: [], status: 'unconfigured' as const };
  try {
    const handle = lifestyleAssortmentHandle(process.env.SHOPIFY_LIFESTYLE_COLLECTION);
    // Shopify's Headless publication and market catalog define the default assortment.
    // An explicit collection is never broadened on missing/empty/provider failure.
    const products = handle ? await listCollectionProducts(handle) : await listProducts();
    return { products, status: products.length ? ('ready' as const) : ('empty' as const) };
  } catch (error) {
    return failedCatalog(error);
  }
}

export async function readLegacyReserveCatalog() {
  if (!commerceConfigured()) return { products: [], status: 'unconfigured' as const };
  try {
    const handle = lifestyleCollectionHandle(process.env.SHOPIFY_LEGACY_RESERVE_COLLECTION);
    const assortment = lifestyleAssortmentHandle(process.env.SHOPIFY_LIFESTYLE_COLLECTION);
    const products = (await listCollectionProducts(handle)).filter((product) =>
      catalogProductAllowed(product, assortment),
    );
    return { products, status: products.length ? ('ready' as const) : ('empty' as const) };
  } catch (error) {
    if (error instanceof CollectionUnavailableError)
      return { products: [], status: 'empty' as const };
    return failedCatalog(error);
  }
}
