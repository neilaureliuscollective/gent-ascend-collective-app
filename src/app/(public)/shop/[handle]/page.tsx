import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { previewProduct } from '@/domains/catalog/preview';
import { commerceConfigured, getProduct } from '@/domains/commerce/shopify';
import { ProductExperience } from '@/components/commerce/product-experience';
export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const handle = (await params).handle;
  const product = commerceConfigured() ? await getProduct(handle).catch(() => null) : null;
  const preview = previewProduct(handle);
  return {
    title: product?.title ?? preview?.name ?? 'Collection',
    description: product?.description ?? preview?.summary,
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
  return (
    <ProductExperience
      key={product?.id ?? handle}
      product={product ?? undefined}
      preview={preview}
      unavailable={failed}
    />
  );
}
