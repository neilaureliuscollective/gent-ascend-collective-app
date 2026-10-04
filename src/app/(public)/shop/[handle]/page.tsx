import type { Metadata } from 'next';
import { previewProduct } from '@/domains/catalog/preview';
import { commerceConfigured, getProduct } from '@/domains/commerce/shopify';
import { shopifyMediaUrl } from '@/domains/commerce/product-story';
import { productPath } from '@/domains/commerce/product-path';
import { productDescription, publicCommerceOrigin } from '@/domains/commerce/product-sharing';
import { ProductPage } from '@/components/commerce/product-page';
export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const handle = (await params).handle;
  const product = commerceConfigured() ? await getProduct(handle).catch(() => null) : null;
  const preview = previewProduct(handle);
  const title = product?.title ?? preview?.name ?? 'Collection';
  const description = product ? productDescription(product) : preview?.summary;
  const origin = publicCommerceOrigin(process.env.NEXT_PUBLIC_APP_URL);
  const path = productPath(handle);
  const url = origin && path ? `${origin}${path}` : undefined;
  const image =
    product?.featuredImage && shopifyMediaUrl(product.featuredImage.url)
      ? product.featuredImage.url
      : undefined;
  return {
    title,
    description,
    ...(url ? { alternates: { canonical: url } } : {}),
    openGraph: {
      title,
      description,
      type: 'website',
      ...(url ? { url } : {}),
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}
export default async function Product({ params }: { params: Promise<{ handle: string }> }) {
  return <ProductPage handle={(await params).handle} />;
}
