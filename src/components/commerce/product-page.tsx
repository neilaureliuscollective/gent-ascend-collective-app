import { notFound } from 'next/navigation';
import { previewProduct } from '@/domains/catalog/preview';
import { commerceConfigured, getProduct, listProducts } from '@/domains/commerce/shopify';
import { readProductStory } from '@/domains/commerce/product-story';
import {
  publicCommerceOrigin,
  productStructuredData,
  safeStructuredJson,
} from '@/domains/commerce/product-sharing';
import { collectionEntries } from '@/domains/commerce/collection';
import { resolveRelated } from '@/domains/commerce/discovery';
import { ProductExperience } from '@/components/commerce/product-experience';
export async function ProductPage({
  handle,
  basePath = '/shop',
}: {
  handle: string;
  basePath?: string;
}) {
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
        basePath={basePath}
      />
    </>
  );
}
