import type { ProductStory } from '@/domains/commerce/product-story';

export type PurchasePolicy = { kind: string; title: string; url: string };
export function PurchaseTerms({
  story,
  policies = [],
}: {
  story: ProductStory | null;
  policies?: PurchasePolicy[];
}) {
  return (
    <details className="reserve-purchase-terms">
      <summary>Delivery, payment & returns</summary>
      <dl>
        <div>
          <dt>Delivery</dt>
          <dd>
            {story?.shipping ||
              'Delivery timing has not been published. Shipping options and charges are confirmed at checkout.'}
          </dd>
        </div>
        <div>
          <dt>Payment</dt>
          <dd>
            {story?.payment ||
              'Review shipping, taxes and the final total at Shopify checkout before placing your order.'}
          </dd>
        </div>
        <div>
          <dt>Returns & cancellation</dt>
          <dd>
            {story?.cancellation ||
              'Product-specific return and cancellation terms have not been published. Review the store policies at checkout before ordering.'}
          </dd>
        </div>
      </dl>
      {policies.length > 0 && (
        <nav aria-label="Merchant policies">
          {policies.map((policy) => (
            <a key={policy.kind} href={policy.url} target="_blank" rel="noopener noreferrer">
              {policy.kind === 'shippingPolicy' ? 'Shipping policy' : 'Returns policy'} ↗
            </a>
          ))}
        </nav>
      )}
      <a href="#release">Read the release details ↓</a>
    </details>
  );
}
