import { productForm } from '@/domains/commerce/product-story';
export function ConceptVessel({
  title,
  kind,
  brand = 'Legacy Reserve',
}: {
  title: string;
  kind: string;
  brand?: string;
}) {
  return (
    <div
      className={`reserve-vessel reserve-vessel--${productForm(kind)}`}
      role="img"
      aria-label={`${title} concept packaging; final product may differ`}
    >
      <div className="reserve-vessel-cap">
        <i />
      </div>
      <div className="reserve-vessel-body">
        <div className="reserve-vessel-label">
          <span>{brand}</span>
          <b aria-hidden="true">◇</b>
          <strong>{title}</strong>
          <small>{kind}</small>
        </div>
      </div>
    </div>
  );
}
