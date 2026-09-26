import Link from 'next/link';
import { collectionPreviews } from '@/domains/catalog/preview';

export function Chapter({ number, label }: { number: string; label: string }) {
  return (
    <div className="world-chapter">
      <span>{number}</span>
      <span>{label}</span>
      <i aria-hidden="true" />
    </div>
  );
}
export function CollectionObject({ form, number }: { form: string; number: string }) {
  return (
    <div
      className={`collection-object collection-object--${form}`}
      role="img"
      aria-label="Abstract packaging study; final packaging is not shown"
    >
      <div className="object-halo" />
      <div className="object-plinth" />
      <div className="object-vessel">
        <i />
        <span>
          LEGACY
          <br />
          RESERVE<small>{number} / THE RITUAL</small>
        </span>
      </div>
      <small className="object-caption">PACKAGING STUDY</small>
    </div>
  );
}
export function CollectionGrid() {
  return (
    <div className="collection-grid">
      {collectionPreviews.map((product) => (
        <Link key={product.handle} href={`/shop/${product.handle}`} className="collection-card">
          <CollectionObject form={product.form} number={product.number} />
          <div className="collection-copy">
            <span className="world-kicker">{product.kind}</span>
            <h3>
              {product.name}
              <span aria-hidden="true">↗</span>
            </h3>
            <p>{product.state}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
export function Invitation() {
  return (
    <section className="world-invitation">
      <span className="world-kicker">A considered beginning</span>
      <h2>
        Find your way <em>in.</em>
      </h2>
      <p>
        Explore the collection. Discover the Reserve. If you have been invited, your personal Gent
        Ascend experience is ready to begin.
      </p>
      <div className="world-actions">
        <Link href="/shop" className="world-button">
          Explore the collection <span>↗</span>
        </Link>
        <Link href="/enter" className="world-text-link">
          I have an invitation <span>↗</span>
        </Link>
      </div>
      <small>Software access is currently by private invitation.</small>
    </section>
  );
}
