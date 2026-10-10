import Link from 'next/link';
import { currentPerson } from '@/domains/person/current';
import { CabinetSave } from './cabinet-controls';
import { saveProductAction } from '@/app/(workspace)/app/collection/actions';
import { notFound } from 'next/navigation';
import { brandProducts, lifestyleCollectionHandle } from '@/domains/commerce/lifestyle';
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
  liveOnly = false,
}: {
  handle: string;
  basePath?: string;
  liveOnly?: boolean;
}) {
  let failed = false;
  const product = commerceConfigured()
    ? await getProduct(handle).catch(() => {
        failed = true;
        return null;
      })
    : null;
  const preview = liveOnly ? undefined : previewProduct(handle);
  if (liveOnly && (failed || !commerceConfigured()))
    return (
      <section className="collection-opening" role="status">
        <h1>Product availability could not be verified.</h1>
        <p>
          {failed
            ? 'Please refresh before choosing a product.'
            : 'Live product availability is not connected yet.'}
        </p>
        <Link href="/app/collection">Return to the collection →</Link>
      </section>
    );
  if (
    liveOnly &&
    product &&
    !brandProducts(
      [product],
      lifestyleCollectionHandle(process.env.SHOPIFY_LEGACY_RESERVE_COLLECTION),
    ).length
  )
    notFound();
  if (!product && !preview) notFound();
  const member = basePath === '/app/collection';
  const person = member && product ? await currentPerson() : null;
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
        cabinetControl={
          member && product ? (
            <section className="reserve-save" aria-label="Synced Cabinet">
              {person ? (
                <>
                  <CabinetSave handle={product.handle} action={saveProductAction} />
                  <Link href="/app/collection/cabinet">Open my Cabinet →</Link>
                  <p>Save to your account across devices. Saving does not order this product.</p>
                </>
              ) : (
                <>
                  <Link href="/enter">Sign in to save to your Cabinet →</Link>
                  <p>Your browser selection remains separate.</p>
                </>
              )}
            </section>
          ) : undefined
        }
      />
    </>
  );
}
