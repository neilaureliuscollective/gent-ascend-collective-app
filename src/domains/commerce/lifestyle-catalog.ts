import 'server-only';
import { commerceConfigured, listCollectionProducts } from './shopify';
import { brandProducts, lifestyleCollectionHandle } from './lifestyle';

export async function readLifestyleCatalog() {
  if (!commerceConfigured()) return { products: [], status: 'unconfigured' as const };
  try {
    const handle = lifestyleCollectionHandle(process.env.SHOPIFY_LEGACY_RESERVE_COLLECTION);
    const products = brandProducts(await listCollectionProducts(handle), handle);
    return { products, status: products.length ? ('ready' as const) : ('empty' as const) };
  } catch {
    return { products: [], status: 'error' as const };
  }
}
