import type { ProductSummary } from './shopify';

/** Shopify collection handle. Not customer-facing brand copy. */
export const LIFESTYLE_BRAND_COLLECTION_HANDLE = 'legacy-reserve';

export const lifestyleBrandAliases = [
  {
    slug: 'legacy-reserve',
    collectionHandle: LIFESTYLE_BRAND_COLLECTION_HANDLE,
    publicPath: '/lifestyle/legacy-reserve',
    memberPath: '/app/lifestyle/legacy-reserve',
    currentPublic: '/shop',
    currentMember: '/app/collection',
  },
] as const;

export function brandProducts<T extends Pick<ProductSummary, 'collections'>>(
  products: T[],
  collectionHandle: string,
) {
  // Merchant collection membership is the explicit assortment boundary.
  // Supplier/vendor names do not establish Aethelios ownership or endorsement.
  return products.filter((product) =>
    product.collections.nodes.some((collection) => collection.handle === collectionHandle),
  );
}

export function lifestyleCollectionHandle(value?: string) {
  const handle = value?.trim() || LIFESTYLE_BRAND_COLLECTION_HANDLE;
  if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(handle))
    throw new Error('Invalid Lifestyle collection configuration');
  return handle;
}

export function productBrand(product: Pick<ProductSummary, 'collections' | 'vendor'>) {
  return product.vendor?.trim() || 'Aethelios Lifestyle';
}

export function memberCommerceBenefit() {
  // No checkout-enforced member offer has been approved or activated.
  return { active: false, priceSource: 'shopify', discount: null } as const;
}

/** A whole-store restriction is opt-in, separate from the default brand collection handle. */
export function lifestyleAssortmentHandle(value?: string): string | null {
  if (!value?.trim()) return null;
  return lifestyleCollectionHandle(value);
}

export function catalogProductAllowed(
  product: Pick<ProductSummary, 'collections'>,
  collectionHandle: string | null,
) {
  // Callers must first resolve a real product/variant through this Headless token.
  return collectionHandle === null || brandProducts([product], collectionHandle).length > 0;
}
