import 'server-only';
import type { Metadata } from 'next';
import { commerceConfigured, getProduct } from './shopify';
import { catalogProductAllowed, lifestyleAssortmentHandle } from './lifestyle';
import { publicCommerceOrigin, productDescription } from './product-sharing';
import { shopifyMediaUrl } from './product-story';

export async function productMetadata(handle: string): Promise<Metadata> {
  const product = commerceConfigured() ? await getProduct(handle).catch(() => null) : null;
  if (
    !product ||
    !catalogProductAllowed(
      product,
      lifestyleAssortmentHandle(process.env.SHOPIFY_LIFESTYLE_COLLECTION),
    )
  )
    return {
      title: 'Product unavailable — Aethelios Lifestyle',
      robots: { index: false, follow: false },
      openGraph: null,
      twitter: null,
    };
  const title = `${product.title} — Aethelios Lifestyle`;
  const description = productDescription(product);
  const origin = publicCommerceOrigin(process.env.NEXT_PUBLIC_APP_URL);
  const url = origin ? `${origin}/shop/${encodeURIComponent(product.handle)}` : undefined;
  const images =
    product.featuredImage && shopifyMediaUrl(product.featuredImage.url)
      ? [{ url: product.featuredImage.url, alt: product.featuredImage.altText ?? product.title }]
      : [];
  return {
    title,
    description,
    ...(url ? { alternates: { canonical: url } } : {}),
    openGraph: { title, description, ...(url ? { url } : {}), images },
    twitter: {
      card: images.length ? 'summary_large_image' : 'summary',
      title,
      description,
      images: images.map((image) => image.url),
    },
  };
}
