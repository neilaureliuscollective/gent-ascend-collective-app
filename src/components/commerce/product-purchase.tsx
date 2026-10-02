'use client';
import { useState } from 'react';
import { commerceEvent } from './commerce-events';
import type { Product } from '@/domains/commerce/shopify';
import { formatMoney } from './money';
import { launchLabel, launchPurchaseAllowed } from '@/domains/commerce/launch-policy';

export function ProductPurchase({ product }: { product: Product }) {
  const open = launchPurchaseAllowed(product);
  const [selected, setSelected] = useState(
    product.variants.nodes.find((entry) => entry.availableForSale)?.id ??
      product.variants.nodes[0]?.id ??
      '',
  );
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const variant = product.variants.nodes.find((entry) => entry.id === selected);
  async function add() {
    if (!variant || !open || busy || !variant.availableForSale) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/commerce/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', variantId: variant.id, quantity }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to add this item.');
      window.dispatchEvent(new Event('gent-ascend-cart-updated'));
      setMessage('Added to your cart.');
      commerceEvent('add_to_cart', product.handle);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Cart unavailable.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="commerce-purchase" id="purchase">
      <div className="commerce-price">
        {variant ? formatMoney(variant.price) : 'Select an option'}
      </div>
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
        disabled={busy || !variant?.availableForSale || !open}
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
              {quantity} {quantity === 1 ? 'item' : 'items'}
            </small>
          </div>
          <button
            className="world-button"
            type="button"
            onClick={add}
            disabled={busy || !variant.availableForSale}
          >
            {busy ? 'Adding…' : variant.availableForSale ? 'Add to cart ↗' : 'Unavailable'}
          </button>
        </div>
      )}
      <p className="commerce-status" role="status">
        {message}
      </p>
    </div>
  );
}
