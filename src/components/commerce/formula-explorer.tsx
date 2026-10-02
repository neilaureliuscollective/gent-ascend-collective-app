'use client';
import type { ProductStory } from '@/domains/commerce/product-story';
import { commerceEvent } from './commerce-events';
export function FormulaExplorer({
  ingredients,
  highlights,
  label,
  cautions,
  handle,
}: {
  ingredients?: string;
  highlights: ProductStory['highlights'];
  label: string;
  cautions?: string;
  handle: string;
}) {
  return (
    <div className="reserve-formula">
      {highlights.length > 0 && (
        <div className="reserve-ingredient-grid">
          {highlights.map((ingredient, index) => (
            <details
              key={ingredient.name}
              onToggle={(event) => {
                if (event.currentTarget.open) commerceEvent('formula_open', handle);
              }}
            >
              <summary>
                <small>FORMULA / {String(index + 1).padStart(2, '0')}</small>
                <strong>{ingredient.name}</strong>
                <span aria-hidden="true">+</span>
              </summary>
              <p>{ingredient.role}</p>
            </details>
          ))}
        </div>
      )}
      {ingredients ? (
        <details
          className="reserve-full-formula"
          onToggle={(event) => {
            if (event.currentTarget.open) commerceEvent('formula_open', handle);
          }}
        >
          <summary>
            View full {label.toLowerCase()} <span aria-hidden="true">+</span>
          </summary>
          <p>{ingredients}</p>
        </details>
      ) : (
        <p className="reserve-pending">
          The full {label.toLowerCase()} will be published with the finished product.
        </p>
      )}
      {cautions && <p className="reserve-caution">{cautions}</p>}
    </div>
  );
}
