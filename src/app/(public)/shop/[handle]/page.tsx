import Link from 'next/link';
import { ProductAtelier } from '@/components/public/product-atelier';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { collectionPreviews, previewProduct } from '@/domains/catalog/preview';
import { Chapter, CollectionObject } from '@/components/public/editorial';
export function generateStaticParams() {
  return collectionPreviews.map(({ handle }) => ({ handle }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const product = previewProduct((await params).handle);
  return { title: product?.name ?? 'Collection', description: product?.summary };
}
export default async function Product({ params }: { params: Promise<{ handle: string }> }) {
  const product = previewProduct((await params).handle);
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
      {product.handle === 'vitalis' && (
        <section className="world-section">
          <ProductAtelier />
        </section>
      )}
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
