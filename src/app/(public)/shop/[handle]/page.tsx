import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { previewProduct } from '@/domains/catalog/preview';
import { Chapter, CollectionObject } from '@/components/public/editorial';
import Image from 'next/image';
import { commerceConfigured, getProduct } from '@/domains/commerce/shopify';
import { ProductPurchase } from '@/components/commerce/product-purchase';
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
  const live = commerceConfigured() ? await getProduct(handle).catch(() => null) : null;
  if (live)
    return (
      <main id="world-main">
        <section className="product-detail commerce-detail">
          <div className="commerce-gallery">
            {live.images.nodes.length
              ? live.images.nodes.map((media, index) => (
                  <Image
                    key={media.url}
                    src={media.url}
                    alt={media.altText ?? `${live.title} view ${index + 1}`}
                    width={media.width ?? 800}
                    height={media.height ?? 1000}
                    sizes="(max-width: 700px) 95vw, 45vw"
                    priority={index === 0}
                  />
                ))
              : live.featuredImage && (
                  <Image
                    src={live.featuredImage.url}
                    alt={live.featuredImage.altText ?? live.title}
                    width={live.featuredImage.width ?? 800}
                    height={live.featuredImage.height ?? 1000}
                    sizes="(max-width: 700px) 95vw, 45vw"
                    priority
                  />
                )}
          </div>
          <div className="commerce-product-copy">
            <Link href="/shop" className="world-text-link">
              ← The collection
            </Link>
            <span className="world-kicker">
              {live.collections.nodes[0]?.title ?? 'Gent Ascend'} /{' '}
              {live.productType || 'The collection'}
            </span>
            <h1>{live.title}</h1>
            <p>{live.purpose?.value || live.description}</p>
            <ProductPurchase product={live} />
            <p className="commerce-note">
              Payment, shipping, and taxes are handled securely at checkout.
            </p>
          </div>
        </section>
        <section className="world-section detail-story commerce-story">
          <Chapter number="01" label="The practice" />
          {live.ritual?.value && (
            <>
              <h2>{live.ritual.value}</h2>
            </>
          )}
          {live.description && <p>{live.description}</p>}
          {live.ingredients?.value && (
            <div>
              <h3>Formulation</h3>
              <p>{live.ingredients.value}</p>
            </div>
          )}
          {live.directions?.value && (
            <div>
              <h3>How to use</h3>
              <p>{live.directions.value}</p>
            </div>
          )}
        </section>
      </main>
    );
  const product = previewProduct(handle);
  if (!product) notFound();
  return (
    <main id="world-main">
      <section className="product-detail">
        <CollectionObject form={product.form} number={product.number} />
        <div>
          <Link href="/shop" className="world-text-link">
            ← The collection
          </Link>
          <p className="world-kicker">
            {product.line} / {product.kind}
          </p>
          <h1>{product.name}</h1>
          <p>{product.summary}</p>
          <span className="product-status">{product.state}</span>
          <div className="preview-notice">
            A collection preview. Final specifications, packaging, pricing, and availability are
            being prepared. This item is not available to order.
          </div>
        </div>
      </section>
      <section className="world-section detail-story">
        <Chapter number={product.number} label="The intention" />
        <h2>{product.ritual}</h2>
        <p>{product.story}</p>
        <div className="world-actions">
          <Link href="/shop" className="world-text-link">
            Continue exploring ↗
          </Link>
          <Link href="/reserve" className="world-text-link">
            Discover care in person ↗
          </Link>
        </div>
      </section>
    </main>
  );
}
