import type { resolveRelated } from '@/domains/commerce/discovery';
import { CollectionCard } from './collection-card';

export function ProductRelations({
  items,
  basePath = '/shop',
}: {
  items: ReturnType<typeof resolveRelated>;
  basePath?: string;
}) {
  if (!items.length) return null;
  return (
    <section className="reserve-related" aria-labelledby="related-title">
      <span className="world-kicker">A considered next step</span>
      <h2 id="related-title">
        Continue your <em>collection.</em>
      </h2>
      <p>
        Explore another option or a different part of the ritual. Each product is chosen separately;
        this is not a bundle or a compatibility guarantee.
      </p>
      {(['alternative', 'complementary'] as const).map((kind) => {
        const group = items.filter((item) => item.kind === kind);
        return group.length ? (
          <div key={kind}>
            <h3>
              {kind === 'alternative' ? 'Another option to consider' : 'Another part of the ritual'}
            </h3>
            <div className="reserve-collection-grid">
              {group.map(({ entry, reason }, index) => (
                <CollectionCard
                  key={entry.handle}
                  entry={entry}
                  basePath={basePath}
                  index={index}
                  reason={reason}
                />
              ))}
            </div>
          </div>
        ) : null;
      })}
    </section>
  );
}
