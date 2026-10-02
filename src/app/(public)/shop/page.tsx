import type { Metadata } from 'next';
import { Chapter, CollectionGrid } from '@/components/public/editorial';
import Image from 'next/image';
import Link from 'next/link';
import { launchLabel, launchPurchaseAllowed } from '@/domains/commerce/launch-policy';
import { formatMoney } from '@/components/commerce/money';
import { commerceConfigured, listProducts } from '@/domains/commerce/shopify';
export const metadata: Metadata = { title: 'The collection' };
export const revalidate = 300;
export default async function Shop() {
  const connected = commerceConfigured();
  let products: Awaited<ReturnType<typeof listProducts>> | null = null;
  let failed = false;
  if (connected) {
    try {
      products = await listProducts();
    } catch {
      failed = true;
    }
  }
  const worlds = [
    { name: 'Grooming', handle: 'grooming', detail: 'The standards you carry into the day.' },
    { name: 'Performance', handle: 'performance', detail: 'What supports the work you put in.' },
    { name: 'Recovery', handle: 'recovery', detail: 'The discipline of restoring well.' },
    { name: 'Daily Ritual', handle: 'daily-ritual', detail: 'Small decisions, made consistently.' },
  ];
  return (
    <main id="world-main">
      <header className="world-page-intro">
        <span className="world-kicker">Legacy Reserve / The founding collection</span>
        <h1>
          Make care
          <br />
          <em>a daily practice.</em>
        </h1>
        <p>
          Considered care and performance within the Gent Ascend world. Explore what is ready, and
          the rituals taking shape.
        </p>
        <div className="world-actions">
          <Link href="/launch" className="world-button">
            Explore the launch collection ↗
          </Link>
          <Link href="/membership" className="world-text-link">
            Founding membership ↗
          </Link>
        </div>
      </header>
      <section className="world-section">
        {products?.length ? (
          <>
            <Chapter number="01" label="Explore the worlds" />
            <div className="commerce-worlds">
              {worlds.map((world) => {
                const count = products.filter((product) =>
                  product.collections.nodes.some((entry) => entry.handle === world.handle),
                ).length;
                return count ? (
                  <Link href={`/shop/world/${world.handle}`} key={world.handle}>
                    <span className="world-kicker">{String(count).padStart(2, '0')} objects</span>
                    <h2>{world.name}.</h2>
                    <p>{world.detail}</p>
                    <span aria-hidden="true">↗</span>
                  </Link>
                ) : null;
              })}
            </div>
            <Chapter number="02" label="The collection" />
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
                  <span className="world-kicker">{product.productType || 'Gent Ascend'}</span>
                  <h3>
                    {product.title} <span aria-hidden="true">↗</span>
                  </h3>
                  <p>
                    {launchPurchaseAllowed(product)
                      ? `From ${formatMoney(product.priceRange.minVariantPrice)}`
                      : launchLabel(product)}
                  </p>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <>
            <Chapter number="01" label="Explore the collection" />
            <CollectionGrid />
            <div className="preview-notice">
              <strong>
                {failed ? 'The collection is temporarily unavailable.' : 'A first look.'}
              </strong>{' '}
              These are collection previews. Final packaging, pricing, and availability will be
              introduced as each product is ready. Orders are not open for these previews.
            </div>
          </>
        )}
      </section>
    </main>
  );
}
