import type { Metadata } from 'next';
import { Chapter, CollectionGrid } from '@/components/public/editorial';
export const metadata: Metadata = { title: 'The collection' };
export default function Shop() {
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
          Considered grooming and personal care within the Gent Ascend world. Explore the direction
          of the collection as it takes shape.
        </p>
      </header>
      <section className="world-section">
        <Chapter number="01" label="Explore the collection" />
        <CollectionGrid />
        <div className="preview-notice">
          <strong>A first look.</strong> These are collection previews. Final packaging, pricing,
          and availability will be introduced as each product is ready. Orders are not open.
        </div>
      </section>
    </main>
  );
}
