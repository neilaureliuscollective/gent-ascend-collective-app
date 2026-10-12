'use client';
import type { ProductStory } from '@/domains/commerce/product-story';
import { commerceEvent } from './commerce-events';
export function FormulaExplorer({
  ingredients,
  highlights,
  label,
  cautions,
  handle,
  descriptionAvailable = false,
}: {
  ingredients?: string;
  highlights: ProductStory['highlights'];
  label: string;
  cautions?: string;
  handle: string;
  descriptionAvailable?: boolean;
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
          {descriptionAvailable
            ? `A separate ${label.toLowerCase()} list is not available here. Review the merchant's product description and packaging before choosing.`
            : `The full ${label.toLowerCase()} has not been published here.`}
        </p>
      )}
      {cautions && <p className="reserve-caution">{cautions}</p>}
    </div>
  );
}
