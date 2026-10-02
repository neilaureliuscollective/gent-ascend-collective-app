import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Chapter } from '@/components/public/editorial';
import { collectionPreviews } from '@/domains/catalog/preview';
import { commerceConfigured, listProducts } from '@/domains/commerce/shopify';
import { launchLabel, launchPurchaseAllowed } from '@/domains/commerce/launch-policy';
import { formatMoney } from '@/components/commerce/money';
import '../founding-launch.css';

export const metadata: Metadata = {
  title: 'The launch collection',
  description:
    'A first look at the products and rituals taking shape within Gent Ascend Collective.',
};
export const revalidate = 300;
const studies: Record<string, string> = {
  vitalis: '/media/world/vitalis-cutout.webp',
  'hair-care': '/media/world/ritual.webp',
  'body-care': '/media/world/obsidian-wash-cutout.webp',
  hydros: '/media/world/hydros-cutout.webp',
};
export default async function Launch() {
  const connected = commerceConfigured();
  const products = connected ? await listProducts().catch(() => null) : [];
  const previews = collectionPreviews.filter(
    (preview) => !products?.some((product) => product.handle === preview.handle),
  );
  return (
    <main id="world-main" className="founding-world">
      <header className="world-page-intro founding-intro">
        <span className="world-kicker">Gent Ascend Collective / The launch collection</span>
        <h1>
          The ritual
          <br />
          <em>takes shape.</em>
        </h1>
        <p>
          Explore the care you will carry into your day. Discover what is ready and take a closer
          look at what comes next.
        </p>
        <div className="world-actions">
          <a href="#launch-collection" className="world-button">
            Explore the collection ↓
          </a>
          <Link href="/membership" className="world-text-link">
            Discover founding membership ↗
          </Link>
        </div>
        <p className="founding-disclosure">
          Member launch offers and paid preorders are being prepared. Preview products cannot be
          ordered yet.
        </p>
      </header>
      <section id="launch-collection" className="world-section">
        <Chapter number="01" label="The founding collection" />
        {products === null && (
          <p role="status" className="preview-notice">
            The live collection is temporarily unavailable. The studies below are previews, not
            substitutes for live availability.
          </p>
        )}
        <div className="launch-collection">
          {products?.map((product) => (
            <article key={product.id} className="launch-object">
              <Link href={`/shop/${product.handle}`} className="launch-image">
                {product.featuredImage && (
                  <Image
                    src={product.featuredImage.url}
                    alt={product.featuredImage.altText ?? product.title}
                    width={product.featuredImage.width ?? 800}
                    height={product.featuredImage.height ?? 1000}
                    sizes="(max-width: 700px) 90vw, 46vw"
                  />
                )}
              </Link>
              <div className="launch-copy">
                <span className="world-kicker">{launchLabel(product)}</span>
                <h2>{product.title}</h2>
                <p>
                  {launchPurchaseAllowed(product)
                    ? `From ${formatMoney(product.priceRange.minVariantPrice)}`
                    : 'Launch details are being prepared. No payment collected.'}
                </p>
                {product.launchWindow?.value && (
                  <p>Estimated launch: {product.launchWindow.value}</p>
                )}
                <Link href={`/shop/${product.handle}`} className="world-text-link">
                  {launchPurchaseAllowed(product) ? 'Discover the product' : 'Explore the preview'}{' '}
                  ↗
                </Link>
              </div>
            </article>
          ))}
          {previews.map((product) => (
            <article key={product.handle} className="launch-object">
              <Link href={`/shop/${product.handle}`} className="launch-image launch-image--study">
                <Image
                  src={studies[product.handle]!}
                  alt={`${product.name} concept study; final packaging is not shown`}
                  width={900}
                  height={1000}
                  sizes="(max-width: 700px) 90vw, 46vw"
                />
                <span className="launch-study-label">Concept study</span>
              </Link>
              <div className="launch-copy">
                <span className="world-kicker">{product.line} / Coming collection</span>
                <h2>{product.name}</h2>
                <p>{product.summary}</p>
                <Link href={`/shop/${product.handle}`} className="world-text-link">
                  Explore the ritual ↗
                </Link>
                <small>Final packaging, pricing and release dates are being prepared.</small>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="world-section founding-close">
        <Chapter number="02" label="First access, clearly defined" />
        <h2>
          A place in
          <br />
          <em>the first chapter.</em>
        </h2>
        <p>
          Founding memberships are planned to include selected launch offers and a one-time curated
          product ritual. When paid preorders open, each product will show what you pay today, its
          estimated shipment window and its cancellation terms before checkout.
        </p>
        <Link href="/membership" className="world-button">
          Explore founding levels ↗
        </Link>
      </section>
    </main>
  );
}
