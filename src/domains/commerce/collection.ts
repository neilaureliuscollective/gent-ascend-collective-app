import type { ProductSummary } from './shopify';
import { collectionPreviews } from '@/domains/catalog/preview';
import { readProductStory, shopifyMediaUrl } from './product-story';
import { launchLabel, launchPurchaseAllowed } from './launch-policy';
import { formatMoney } from '@/components/commerce/money';
export type CollectionEntry = {
  handle: string;
  title: string;
  kind: string;
  brand: string;
  summary: string;
  price: string;
  status: string;
  size?: string;
  image?: { url: string; altText: string | null };
  categories: string[];
};
export function collectionEntries(
  products: ProductSummary[],
  includePreviews = false,
): CollectionEntry[] {
  const entries: CollectionEntry[] = products.map((product) => {
    const story = readProductStory(product.story);
    return {
      handle: product.handle,
      title: product.title,
      kind: product.productType || 'The collection',
      brand: /legacy/i.test(product.collections.nodes.map((c) => c.title).join(' '))
        ? 'Legacy Reserve'
        : 'Gent Ascend',
      summary: story?.benefit || '',
      price: launchPurchaseAllowed(product)
        ? `From ${formatMoney(product.priceRange.minVariantPrice)}`
        : 'Pricing at release',
      status: launchPurchaseAllowed(product)
        ? product.availableForSale
          ? 'Available'
          : 'Unavailable'
        : launchLabel(product),
      size: story?.size,
      image:
        story?.mediaApproved && product.featuredImage && shopifyMediaUrl(product.featuredImage.url)
          ? product.featuredImage
          : undefined,
      categories: product.collections.nodes.map((collection) => collection.handle),
    };
  });
  if (includePreviews)
    for (const preview of collectionPreviews) {
      if (entries.some((entry) => entry.handle === preview.handle)) continue;
      entries.push({
        handle: preview.handle,
        title: preview.name,
        kind: preview.kind,
        brand: preview.line,
        summary: preview.summary,
        price: 'Pricing at release',
        status: preview.state,
        categories: preview.handle === 'hydros' ? ['performance'] : ['grooming'],
      });
    }
  return entries.sort((a, b) => Number(b.handle === 'vitalis') - Number(a.handle === 'vitalis'));
}
