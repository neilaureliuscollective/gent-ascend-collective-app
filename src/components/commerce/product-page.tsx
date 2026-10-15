import { currentPerson } from '@/domains/person/current';
import { CabinetSave } from './cabinet-controls';
import { saveProductAction } from '@/app/(workspace)/app/collection/actions';
import { notFound } from 'next/navigation';
import { catalogProductAllowed, lifestyleAssortmentHandle } from '@/domains/commerce/lifestyle';
import { previewProduct } from '@/domains/catalog/preview';
import {
  commerceConfigured,
  getProduct,
  listProducts,
  getPurchasePolicies,
} from '@/domains/commerce/shopify';
import { readProductStory } from '@/domains/commerce/product-story';
import {
  publicCommerceOrigin,
  productStructuredData,
  safeStructuredJson,
} from '@/domains/commerce/product-sharing';
import { collectionEntries } from '@/domains/commerce/collection';
import { resolveRelated } from '@/domains/commerce/discovery';
import { ProductExperience } from '@/components/commerce/product-experience';
import { CollectionReturnLink } from './collection-return-link';
import { LifestyleAction } from './lifestyle-action';
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
  const policiesPromise = commerceConfigured()
    ? getPurchasePolicies().catch(() => [])
    : Promise.resolve([]);
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
        <CollectionReturnLink fallback={basePath} className="world-button">
          Return to the collection
        </CollectionReturnLink>
      </section>
    );
  if (
    liveOnly &&
    product &&
    !catalogProductAllowed(
      product,
      lifestyleAssortmentHandle(process.env.SHOPIFY_LIFESTYLE_COLLECTION),
    )
  )
    notFound();
  if (!product && !preview) notFound();
  const member = basePath === '/app/collection';
  const person = member && product ? await currentPerson() : null;
  const story = readProductStory(product?.story);
  const relatedProducts = story?.related.length ? await listProducts().catch(() => []) : [];
  const related = resolveRelated(
    story,
    handle,
    collectionEntries(
      liveOnly
        ? relatedProducts.filter((entry) =>
            catalogProductAllowed(
              entry,
              lifestyleAssortmentHandle(process.env.SHOPIFY_LIFESTYLE_COLLECTION),
            ),
          )
        : relatedProducts,
    ),
  );
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
        policies={await policiesPromise}
        cabinetControl={
          member && product ? (
            <section className="reserve-save" aria-label="Cabinet and Grooming">
              {person ? (
                <>
                  <CabinetSave handle={product.handle} action={saveProductAction} />
                  <p>
                    Save keeps this product in your account Cabinet. It does not mark it as owned or
                    place an order.
                  </p>
                  <div className="collection-entry-actions">
                    <LifestyleAction href="/app/collection/cabinet" className="world-text-link">
                      Open Cabinet
                    </LifestyleAction>
                    <LifestyleAction href="/app/grooming" className="world-text-link">
                      Open Grooming
                    </LifestyleAction>
                  </div>
                </>
              ) : (
                <>
                  <LifestyleAction href="/enter" className="world-text-link">
                    Sign in to save to your Cabinet
                  </LifestyleAction>
                  <p>Your browser selection remains separate from Cabinet and from purchasing.</p>
                </>
              )}
            </section>
          ) : undefined
        }
      />
    </>
  );
}
