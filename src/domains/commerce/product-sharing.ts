import type { Product } from './shopify';
import { readProductStory, shopifyMediaUrl } from './product-story';
import { launchPurchaseAllowed } from './launch-policy';
import { productPath } from './product-path';

export function publicCommerceOrigin(value?: string) {
  try {
    const url = new URL(value ?? '');
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function productDescription(product: Product) {
  const story = readProductStory(product.story);
  return (story?.benefit || product.purpose?.value || product.description)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

export function productStructuredData(product: Product, rawOrigin: string | null) {
  const origin = publicCommerceOrigin(rawOrigin ?? undefined);
  const path = productPath(product.handle);
  if (!origin || !path) return null;
  const image =
    product.featuredImage && shopifyMediaUrl(product.featuredImage.url)
      ? product.featuredImage.url
      : undefined;
  // Preview prices and unsupported selling plans never become searchable offers.
  const offers = launchPurchaseAllowed(product)
    ? product.variants.nodes
        .filter(
          (variant) =>
            /^\d+(?:\.\d{1,2})?$/.test(variant.price.amount) &&
            Number.isFinite(Number(variant.price.amount)) &&
            /^[A-Z]{3}$/.test(variant.price.currencyCode),
        )
        .map((variant) => ({
          '@type': 'Offer',
          name: variant.title,
          url: `${origin}${path}`,
          price: variant.price.amount,
          priceCurrency: variant.price.currencyCode,
          availability:
            product.availableForSale && variant.availableForSale
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
        }))
    : [];
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: productDescription(product),
    url: `${origin}${path}`,
    ...(image ? { image: [image] } : {}),
    ...(offers.length ? { offers } : {}),
  };
}

export function safeStructuredJson(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
