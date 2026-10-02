import Link from 'next/link';
import type { Product } from '@/domains/commerce/shopify';
import { launchPurchaseAllowed, launchState, launchLabel } from '@/domains/commerce/launch-policy';
import { readProductStory, shopifyMediaUrl } from '@/domains/commerce/product-story';
import { previewProduct } from '@/domains/catalog/preview';
import { vitalisDevelopmentHighlights } from '@/domains/catalog/vitalis-development';
import { ProductAtelier } from '@/components/public/product-atelier';
import { ProductPurchase } from './product-purchase';
import { ProductGallery } from './product-gallery';
import { CollectionSave } from './collection-save';
import { FormulaExplorer } from './formula-explorer';
import { ProductView } from './product-view';

type Preview = NonNullable<ReturnType<typeof previewProduct>>;
export function ProductExperience({
  product,
  preview,
  unavailable = false,
}: {
  product?: Product;
  preview?: Preview;
  unavailable?: boolean;
}) {
  const title = product?.title ?? preview!.name;
  const handle = product?.handle ?? preview!.handle;
  const kind = product?.productType || preview?.kind || 'The collection';
  const story = readProductStory(product?.story);
  const live = Boolean(product);
  const open = product ? launchPurchaseAllowed(product) : false;
  const brand =
    preview?.line ??
    (product?.collections.nodes.find((c) => /legacy/i.test(c.title))?.title || 'Gent Ascend');
  const intro =
    story?.benefit ||
    product?.purpose?.value ||
    product?.description ||
    preview?.summary ||
    'A considered part of your daily ritual.';
  const images = story?.mediaApproved
    ? product?.images.nodes.length
      ? product.images.nodes
      : product?.featuredImage
        ? [product.featuredImage]
        : []
    : [];
  const model = story?.mediaApproved
    ? product?.media?.nodes
        .flatMap((media) => media.sources ?? [])
        .find(
          (source) =>
            source.format.toLowerCase() === 'glb' &&
            source.filesize > 0 &&
            source.filesize <= 10000000 &&
            shopifyMediaUrl(source.url),
        )?.url
    : undefined;
  const beard = /beard|vitalis/i.test(`${title} ${kind}`);
  const faq = story?.faq ?? [];
  const developmentBlend = !product && handle === 'vitalis';
  return (
    <main id="world-main" className="reserve-commerce reserve-product">
      <ProductView handle={handle} />
      <section className="reserve-product-intro">
        <div id="atelier" className="reserve-product-visual">
          {!images.length && handle === 'vitalis' ? (
            <ProductAtelier stageOnly />
          ) : (
            <ProductGallery title={title} kind={kind} brand={brand} images={images} model={model} />
          )}
        </div>
        <div className="reserve-product-copy">
          <Link href="/shop" className="world-text-link">
            ← The collection
          </Link>
          <span className="world-kicker">
            {brand} / {kind}
          </span>
          <h1>
            {title}
            <em>.</em>
          </h1>
          <p className="reserve-product-purpose">{intro}</p>
          <div className="reserve-product-facts">
            <span>{kind}</span>
            {story?.size && <span>{story.size}</span>}
            <span>
              {open
                ? product?.availableForSale
                  ? 'Available to order'
                  : 'Currently unavailable'
                : product
                  ? launchLabel(product)
                  : preview!.state}
            </span>
          </div>
          {unavailable && (
            <p className="preview-notice" role="status">
              Live availability is temporarily unavailable. This is a collection preview.
            </p>
          )}
          {product ? (
            <ProductPurchase product={product} />
          ) : (
            <div className="reserve-preview-release">
              <strong>Coming to the collection.</strong>
              <p>
                This item is not available to order. Final specifications, packaging, pricing, and
                availability are being prepared.
              </p>
              <a href="#release" className="world-text-link">
                Explore the first release ↓
              </a>
            </div>
          )}
          <CollectionSave handle={handle} />
        </div>
      </section>
      <nav className="reserve-product-nav" aria-label="Product chapters">
        <a href="#fit">The intention</a>
        <a href="#formula">The formula</a>
        <a href="#ritual">The ritual</a>
        <a href="#release">The release</a>
      </nav>
      <section id="fit" className="reserve-editorial-section reserve-fit">
        <div>
          <span className="world-kicker">01 / The intention</span>
          <h2>
            Care with
            <br />
            <em>a purpose.</em>
          </h2>
        </div>
        <div>
          <p>{story?.fit || preview?.story || product?.purpose?.value || intro}</p>
          {story?.quality && <p>{story.quality}</p>}
          {!story?.fit && beard && (
            <div className="reserve-education">
              <h3>Begin with the skin beneath.</h3>
              <p>
                A beard routine starts with cleansing and care for the skin underneath. Your skin
                type matters when choosing a beard oil, conditioner, or moisturizer.
              </p>
              <a
                href="https://www.aad.org/public/everyday-care/skin-care-secrets/face/healthy-beard"
                target="_blank"
                rel="noreferrer"
              >
                Beard-care guidance · American Academy of Dermatology ↗
              </a>
              <small>General care education; not a claim about this product.</small>
            </div>
          )}
        </div>
      </section>
      {story?.texture || story?.scent.length ? (
        <section className="reserve-sensory reserve-editorial-section">
          <div>
            <span className="world-kicker">The experience</span>
            <h2>
              A standard
              <br />
              <em>you can feel.</em>
            </h2>
            {story.texture && <p>{story.texture}</p>}
          </div>
          <div className="reserve-scent-notes">
            {story.scent.map((note, index) => (
              <div key={`${note.label}-${index}`}>
                <small>{note.label}</small>
                <strong>{note.value}</strong>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <section id="formula" className="reserve-editorial-section reserve-formula-section">
        <div>
          <span className="world-kicker">02 / Inside the formula</span>
          <h2>
            Know what
            <br />
            <em>goes into it.</em>
          </h2>
          <p>
            {story?.factsLabel === 'Supplement Facts'
              ? 'Review amounts, serving information, and directions before choosing.'
              : 'Explore the ingredients and their place in the formula.'}
          </p>
        </div>
        <FormulaExplorer
          handle={handle}
          ingredients={product?.ingredients?.value}
          highlights={story?.highlights ?? (developmentBlend ? vitalisDevelopmentHighlights : [])}
          label={
            story?.factsLabel ??
            (/supplement|electrolyte|creatine|gumm|vitamin/i.test(kind)
              ? 'Supplement Facts'
              : 'Ingredients')
          }
          cautions={
            story?.cautions ??
            (developmentBlend
              ? 'Formula direction supplied by the founder. These are selected components, not the full ingredient label. Final INCI, fragrance, and directions will be published before orders open.'
              : undefined)
          }
        />
      </section>
      <section id="ritual" className="reserve-editorial-section reserve-ritual-section">
        <div>
          <span className="world-kicker">03 / The daily practice</span>
          <h2>
            Make it
            <br />
            <em>your ritual.</em>
          </h2>
          <p>
            {product?.ritual?.value ||
              preview?.ritual ||
              'A considered place in your daily routine.'}
          </p>
        </div>
        <div>
          {story?.steps.length ? (
            <ol className="reserve-steps">
              {story.steps.map((step, index) => (
                <li key={step.title}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : product?.directions?.value ? (
            <p>{product.directions.value}</p>
          ) : (
            <div className="reserve-ritual-pending">
              <span aria-hidden="true">◇</span>
              <h3>A deliberate beginning.</h3>
              <p>Application amount and frequency will be confirmed with the finished formula.</p>
            </div>
          )}
        </div>
      </section>
      <section id="release" className="reserve-editorial-section reserve-release-section">
        <div>
          <span className="world-kicker">04 / The first release</span>
          <h2>
            Your next
            <br />
            <em>daily essential.</em>
          </h2>
          <p>
            {open
              ? 'Choose your selection above. Membership is optional for product purchases.'
              : 'Explore now. Choose with confidence when the release is ready.'}
          </p>
        </div>
        <div className="reserve-release-facts">
          <div>
            <span>Availability</span>
            <p>
              {product
                ? open
                  ? product.availableForSale
                    ? 'Open for ordering.'
                    : 'Currently unavailable.'
                  : launchLabel(product)
                : 'Collection preview. Orders are not open.'}
            </p>
          </div>
          <div>
            <span>{open ? 'Shipping' : 'Release window'}</span>
            <p>
              {open
                ? story?.shipping || 'Shipping options and charges are confirmed at checkout.'
                : product?.launchWindow?.value || 'The release date is being prepared.'}
            </p>
          </div>
          <div>
            <span>Payment</span>
            <p>
              {open
                ? story?.payment ||
                  'The total, including shipping and taxes, is reviewed at secure checkout.'
                : 'No payment is collected for this preview.'}
            </p>
          </div>
          {story?.cancellation && (
            <div>
              <span>Cancellation & returns</span>
              <p>{story.cancellation}</p>
            </div>
          )}
          {product && launchState(product) === 'preorder' && (
            <p className="reserve-pending">
              Paid preorders will open after shipment and payment terms are confirmed. Saving this
              product does not reserve inventory.
            </p>
          )}
          <a href="#world-main" className="world-text-link">
            {open ? 'Return to your selection ↑' : 'Save for your collection ↑'}
          </a>
        </div>
      </section>
      <section className="reserve-membership-bridge">
        <span className="world-kicker">Gent Ascend Collective / Beyond the shelf</span>
        <h2>
          The product.
          <br />
          <em>The practice behind it.</em>
        </h2>
        <p>
          Your personal workspace brings direction, daily actions, progress, and Aethelios together.
          Member product offers are being prepared; no product discount is promised with this
          purchase.
        </p>
        <div className="world-actions">
          <Link href="/membership" className="world-button">
            Explore membership ↗
          </Link>
          <Link href="/join" className="world-text-link">
            Explore your account ↗
          </Link>
        </div>
        <small>
          Creating an account does not subscribe you or charge you. Product purchases do not require
          a paid membership.
        </small>
      </section>
      <section className="reserve-editorial-section reserve-faq">
        <div>
          <span className="world-kicker">Before you choose</span>
          <h2>
            A few
            <br />
            <em>good questions.</em>
          </h2>
        </div>
        <div>
          {faq.map((item) => (
            <details key={item.question}>
              <summary>
                {item.question}
                <span aria-hidden="true">+</span>
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
          <details>
            <summary>
              Do I need a membership to purchase?<span aria-hidden="true">+</span>
            </summary>
            <p>
              No. Products that are open for ordering can be purchased independently of a paid Gent
              Ascend membership.
            </p>
          </details>
          {!open && (
            <details>
              <summary>
                Can I order this preview?<span aria-hidden="true">+</span>
              </summary>
              <p>
                No. A preview introduces the collection. Orders open only when the product and its
                release terms are ready.
              </p>
            </details>
          )}
          <details>
            <summary>
              What does saving to my collection do?<span aria-hidden="true">+</span>
            </summary>
            <p>
              It keeps a saved selection in this browser. It does not reserve stock, place an order,
              sign you up for notifications, or sync with your account.
            </p>
          </details>
        </div>
      </section>
      {!live && (
        <p className="reserve-preview-footer">
          Collection preview · final product details will be published before orders open.
        </p>
      )}
    </main>
  );
}
