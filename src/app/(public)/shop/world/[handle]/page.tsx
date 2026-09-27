import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatMoney } from '@/components/commerce/money';
import { commerceConfigured, listProducts } from '@/domains/commerce/shopify';
const worlds: Record<string, string> = {
  grooming: 'Grooming',
  performance: 'Performance',
  recovery: 'Recovery',
  'daily-ritual': 'Daily Ritual',
};
export const revalidate = 300;
export default async function World({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  if (!commerceConfigured() || !worlds[handle]) notFound();
  const products = (await listProducts()).filter((product) =>
    product.collections.nodes.some((collection) => collection.handle === handle),
  );
  if (!products.length) notFound();
  return (
    <main id="world-main">
      <header className="world-page-intro">
        <Link href="/shop" className="world-text-link">
          ← The collection
        </Link>
        <span className="world-kicker">Gent Ascend / The worlds</span>
        <h1>{worlds[handle]}.</h1>
        <p>Objects for a considered daily practice.</p>
      </header>
      <section className="world-section">
        <div className="commerce-grid">
          {products.map((product) => (
            <Link key={product.id} href={`/shop/${product.handle}`} className="commerce-card">
              <div className="commerce-image">
                {product.featuredImage && (
                  <Image
                    src={product.featuredImage.url}
                    alt={product.featuredImage.altText ?? product.title}
                    width={product.featuredImage.width ?? 800}
                    height={product.featuredImage.height ?? 1000}
                    sizes="(max-width: 700px) 80vw, 30vw"
                  />
                )}
              </div>
              <h2>{product.title}</h2>
              <p>From {formatMoney(product.priceRange.minVariantPrice)}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
