import Link from 'next/link';
import Image from 'next/image';
import type { CollectionEntry } from '@/domains/commerce/collection';
import { ProductMediaPending } from './product-media-pending';
import { CollectionSave } from './collection-save';

export function CollectionCard({
  entry,
  index = 0,
  reason,
  review = false,
}: {
  entry: CollectionEntry;
  index?: number;
  reason?: string;
  review?: boolean;
}) {
  return (
    <article className="reserve-collection-object">
      <Link href={`/shop/${entry.handle}`} className="reserve-collection-card">
        <div className="reserve-card-stage">
          <span className="reserve-card-number">
            {String(index + 1).padStart(2, '0')} / {entry.brand}
          </span>
          {entry.image ? (
            <Image
              src={entry.image.url}
              alt={entry.image.altText ?? entry.title}
              width={600}
              height={740}
              sizes="(max-width: 560px) 90vw, (max-width: 960px) 45vw, 30vw"
            />
          ) : (
            <ProductMediaPending title={entry.title} />
          )}
          <small>{entry.image ? entry.status : 'Photography forthcoming'}</small>
        </div>
        <div className="reserve-card-copy">
          <span className="world-kicker">
            {entry.kind}
            {entry.size ? ` / ${entry.size}` : ''}
          </span>
          <h3>
            {entry.title}
            <span aria-hidden="true">↗</span>
          </h3>
          {entry.summary && <p>{entry.summary}</p>}
          <div className="reserve-card-price">
            <strong>{entry.price}</strong>
            <span>{entry.status}</span>
          </div>
        </div>
      </Link>
      {reason && <p className="reserve-match-reason">{reason}</p>}
      {review && (
        <dl className="reserve-selection-facts">
          <div>
            <dt>Purpose & fit</dt>
            <dd>{entry.fit || entry.summary || 'Product fit has not been published.'}</dd>
          </div>
          <div>
            <dt>Feel & finish</dt>
            <dd>{entry.texture || 'Texture details have not been published.'}</dd>
          </div>
          <div>
            <dt>Scent</dt>
            <dd>{entry.scent || 'Scent details have not been published.'}</dd>
          </div>
          <div>
            <dt>Before you choose</dt>
            <dd>
              <Link href={`/shop/${entry.handle}#formula`}>
                Review {entry.title} ingredients & cautions ↗
              </Link>
            </dd>
          </div>
        </dl>
      )}
      <CollectionSave handle={entry.handle} title={entry.title} compact />
    </article>
  );
}
