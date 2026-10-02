import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { previewProduct } from '@/domains/catalog/preview';
import { commerceConfigured, getProduct, listProducts } from '@/domains/commerce/shopify';
import { readProductStory, shopifyMediaUrl } from '@/domains/commerce/product-story';
import { productPath } from '@/domains/commerce/product-path';
import {
  productDescription,
  publicCommerceOrigin,
  productStructuredData,
  safeStructuredJson,
} from '@/domains/commerce/product-sharing';
import { collectionEntries } from '@/domains/commerce/collection';
import { resolveRelated } from '@/domains/commerce/discovery';
import { ProductExperience } from '@/components/commerce/product-experience';
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
  const story = readProductStory(product?.story);
  const image =
    story?.mediaApproved && product?.featuredImage && shopifyMediaUrl(product.featuredImage.url)
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
  const handle = (await params).handle;
  let failed = false;
  const product = commerceConfigured()
    ? await getProduct(handle).catch(() => {
        failed = true;
        return null;
      })
    : null;
  const preview = previewProduct(handle);
  if (!product && !preview) notFound();
  const story = readProductStory(product?.story);
  const relatedProducts = story?.related.length ? await listProducts().catch(() => []) : [];
  const related = resolveRelated(story, handle, collectionEntries(relatedProducts));
  const structured = product
    ? productStructuredData(product, publicCommerceOrigin(process.env.NEXT_PUBLIC_APP_URL))
    : null;
  return (
    <>
      {structured && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeStructuredJson(structured) }}
        />
      )}
      <ProductExperience
        key={product?.id ?? handle}
        product={product ?? undefined}
        preview={preview}
        unavailable={failed}
        related={related}
      />
    </>
  );
}
