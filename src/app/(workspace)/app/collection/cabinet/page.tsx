import Link from 'next/link';
import Image from 'next/image';
import { currentPerson } from '@/domains/person/current';
import { CabinetError, cabinetWorkspace } from '@/domains/commerce/cabinet';
import { cabinetLabels } from '@/domains/commerce/cabinet-model';
import { commerceConfigured, listProducts } from '@/domains/commerce/shopify';
import { collectionEntries } from '@/domains/commerce/collection';
import { productPath } from '@/domains/commerce/product-path';
import {
  CabinetEditor,
  CabinetExternal,
  CabinetSave,
} from '@/components/commerce/cabinet-controls';
import { cabinetProductAction, externalProductAction, saveProductAction } from '../actions';
import '../collection.css';
export const metadata = {
  title: 'Your Cabinet | Gent Ascend',
  robots: { index: false, follow: false },
};
export default async function Collection({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const person = await currentPerson();
  if (!person)
    return (
      <section className="member-collection">
        <h1>Your Cabinet.</h1>
        <p>Sign in to keep your products across devices.</p>
        <Link href="/enter">Sign in →</Link>
      </section>
    );
  const params = await searchParams,
    page = /^\d{1,4}$/.test(params.page ?? '') ? Number(params.page) : 0;
  const catalogPromise = commerceConfigured()
    ? listProducts().catch(() => null)
    : Promise.resolve(null);
  let data;
  try {
    data = await cabinetWorkspace(page);
  } catch (error) {
    if (!(error instanceof CabinetError)) throw error;
    return (
      <section className="member-collection">
        <h1>Your Cabinet.</h1>
        <p role="alert">{error.message}</p>
        <Link href="/app/collection/cabinet">Try again →</Link>
      </section>
    );
  }
  const catalog = await catalogPromise,
    entries = catalog ? collectionEntries(catalog).slice(0, 12) : [];
  return (
    <section className="member-collection">
      <header className="cabinet-hero">
        <p className="eyebrow">GENT ASCEND / THE COLLECTION</p>
        <h1>
          Your standard.
          <br />
          <em>Kept in reach.</em>
        </h1>
        <p>Save what interests you. Remember what you use.</p>
        <nav aria-label="Product areas">
          <a href="#cabinet">Your Cabinet</a>
          <a href="#collection">The Collection</a>
          <Link href="/app/grooming">Grooming ritual →</Link>
        </nav>
      </header>
      <section id="cabinet">
        <p className="eyebrow">YOUR CABINET</p>
        <h2>What earns its place.</h2>
        <p>
          Experience and ownership are recorded by you. Products you already keep belong here,
          wherever you bought them.
        </p>
        {!data.records.length ? (
          <p>
            {page
              ? 'No more records on this page.'
              : 'Your Cabinet is ready. Save a product below or record one you already own.'}
          </p>
        ) : null}
        <div className="cabinet-records">
          {data.records.map((record) => {
            const href = record.shopify_handle
              ? productPath(record.shopify_handle)?.replace('/shop/', '/app/collection/')
              : null;
            return (
              <article className="cabinet-record" key={record.id}>
                <p className="eyebrow">{cabinetLabels[record.relation]} / MEMBER RECORDED</p>
                <h3>{record.name}</h3>
                {href ? <Link href={href}>Inspect product →</Link> : null}
                <details>
                  <summary>Review my experience</summary>
                  <CabinetEditor
                    key={`${record.id}:${record.version}`}
                    record={record}
                    rituals={data.rituals}
                    action={cabinetProductAction}
                  />
                </details>
              </article>
            );
          })}
        </div>
        <nav className="cabinet-actions" aria-label="Cabinet pages">
          {page > 0 ? (
            <Link href={`/app/collection/cabinet?page=${page - 1}#cabinet`}>Previous</Link>
          ) : null}
          {data.hasMore ? (
            <Link href={`/app/collection/cabinet?page=${page + 1}#cabinet`}>Next</Link>
          ) : null}
        </nav>
        <details className="cabinet-external">
          <summary>Keep a product from elsewhere</summary>
          <CabinetExternal id={crypto.randomUUID()} action={externalProductAction} />
        </details>
      </section>
      <section id="collection">
        <p className="eyebrow">THE COLLECTION</p>
        <h2>Consider your next essential.</h2>
        <p>Published retail prices. Saving a product does not order it.</p>
        {!catalog ? (
          <p>The live collection is temporarily unavailable. Your Cabinet remains yours.</p>
        ) : null}
        {catalog && !entries.length ? <p>No published products are available right now.</p> : null}
        <div className="cabinet-shelf">
          {entries.map((entry) => (
            <article key={entry.handle}>
              {entry.image ? (
                <div className="cabinet-image">
                  <Image
                    src={entry.image.url}
                    alt={entry.image.altText ?? entry.title}
                    fill
                    sizes="(max-width: 650px) 85vw, 30vw"
                  />
                </div>
              ) : null}
              <p className="eyebrow">{entry.brand}</p>
              <h3>
                <Link href={`/app/collection/${entry.handle}`}>{entry.title}</Link>
              </h3>
              <p>
                {entry.price} · {entry.status}
              </p>
              <CabinetSave handle={entry.handle} action={saveProductAction} />
            </article>
          ))}
        </div>
        <Link className="secondary-button" href="/app/collection">
          Explore the full collection →
        </Link>
      </section>
    </section>
  );
}
