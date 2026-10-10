import type { ProductSummary } from './shopify';

export const lifestyleBrands = [
  {
    slug: 'legacy-reserve',
    name: 'Legacy Reserve',
    description: 'Premium grooming and personal care. A considered standard for the everyday.',
    collectionHandle: 'legacy-reserve',
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
  const handle = value?.trim() || lifestyleBrands[0].collectionHandle;
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
