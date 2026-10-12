'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { commerceEvent } from './commerce-events';
import type { Product } from '@/domains/commerce/shopify';
import { formatMoney } from './money';
import { launchLabel, launchPurchaseAllowed } from '@/domains/commerce/launch-policy';

export function ProductPurchase({
  product,
  basePath = '/shop',
}: {
  product: Product;
  basePath?: string;
}) {
  const open = launchPurchaseAllowed(product);
  const [selected, setSelected] = useState(
    product.variants.nodes.find((entry) => entry.availableForSale)?.id ??
      product.variants.nodes[0]?.id ??
      '',
  );
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const pending = useRef(false);
  const [uncertain, setUncertain] = useState(false);
  const variant = product.variants.nodes.find((entry) => entry.id === selected);
  async function add() {
    if (!variant || !open || pending.current || uncertain || !variant.availableForSale) return;
    pending.current = true;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/commerce/cart', {
        signal: AbortSignal.timeout(20000),
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', variantId: variant.id, quantity }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status >= 500) throw new Error(result.error ?? 'Unable to add this item.');
        setMessage(result.error ?? 'Unable to add this item.');
        return;
      }
      window.dispatchEvent(new Event('gent-ascend-cart-updated'));
      setMessage('Added to your cart.');
      commerceEvent('add_to_cart', product.handle);
    } catch (error) {
      setUncertain(true);
      setMessage(error instanceof Error ? error.message : 'Cart unavailable.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="commerce-purchase" id="purchase">
      <div className="commerce-price">
        {variant ? formatMoney(variant.price) : 'Select an option'}
      </div>
      {variant?.compareAtPrice &&
        variant.compareAtPrice.currencyCode === variant.price.currencyCode &&
        Number(variant.compareAtPrice.amount) > Number(variant.price.amount) && (
          <p>
            Regular price <s>{formatMoney(variant.compareAtPrice)}</s>
          </p>
        )}
      {variant?.currentlyNotInStock && (
        <p role="status">Available on backorder. Review fulfillment timing before checkout.</p>
      )}
      {variant && (
        <p className="reserve-order-summary" aria-live="polite">
          {quantity} × {variant.title} · Item subtotal{' '}
          <strong>
            {formatMoney({
              ...variant.price,
              amount: String(Number(variant.price.amount) * quantity),
            })}
          </strong>
          <small>Shipping and taxes calculated at checkout.</small>
        </p>
      )}
      {!open && (
        <p className="preview-notice">
          {launchLabel(product)}. Payment is not being collected for this item.
          {product.launchWindow?.value ? ` Estimated launch: ${product.launchWindow.value}.` : ''}
        </p>
      )}
      {product.variants.nodes.length > 1 && (
        <label className="commerce-field">
          Choose an option
          <select
            value={selected}
            disabled={busy}
            onChange={(event) => {
              setSelected(event.target.value);
              setMessage('');
            }}
          >
            {product.variants.nodes.map((option) => (
              <option key={option.id} value={option.id} disabled={!option.availableForSale}>
                {option.title} · {formatMoney(option.price)}
                {option.availableForSale ? '' : ' · Unavailable'}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="commerce-field">
        Quantity
        <select
          disabled={busy || !open}
          value={quantity}
          onChange={(event) => setQuantity(Number(event.target.value))}
        >
          {[1, 2, 3, 4, 5].map((count) => (
            <option key={count} value={count}>
              {count}
            </option>
          ))}
        </select>
      </label>
      <button
        className="world-button commerce-add"
        type="button"
        onClick={add}
        disabled={busy || uncertain || !variant?.availableForSale || !open}
      >
        {!open
          ? launchLabel(product)
          : busy
            ? 'Adding…'
            : variant?.availableForSale
              ? 'Add to cart ↗'
              : 'Currently unavailable'}
      </button>
      {open && variant && (
        <div className="reserve-sticky-purchase">
          <div>
            <span>{product.title}</span>
            <strong>
              {formatMoney({
                ...variant.price,
                amount: String(Number(variant.price.amount) * quantity),
              })}
            </strong>
            <small>
              {variant.title} · {quantity} {quantity === 1 ? 'item' : 'items'}
            </small>
          </div>
          <button
            className="world-button"
            type="button"
            onClick={add}
            disabled={busy || uncertain || !variant.availableForSale}
          >
            {busy ? 'Adding…' : variant.availableForSale ? 'Add to cart ↗' : 'Unavailable'}
          </button>
        </div>
      )}
      <p className="commerce-status" role="status">
        {message}
      </p>
      {uncertain && (
        <p className="commerce-status" role="status">
          The result could not be confirmed. Review your cart before adding this item again.
          <Link href={`${basePath}/cart`}>Review cart →</Link>
        </p>
      )}
    </div>
  );
}
