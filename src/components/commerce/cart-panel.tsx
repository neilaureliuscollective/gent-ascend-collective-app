'use client';
import Image from 'next/image';
import { commerceEvent } from './commerce-events';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Cart } from '@/domains/commerce/shopify';
import { formatMoney } from './money';
import { launchLabel, launchPurchaseAllowed } from '@/domains/commerce/launch-policy';

export function CartPanel({
  fullPage = false,
  notice,
  basePath = '/shop',
}: {
  fullPage?: boolean;
  notice?: string;
  basePath?: string;
}) {
  const [open, setOpen] = useState(fullPage);
  const [cart, setCart] = useState<Cart | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const closeButton = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const loadVersion = useRef(0);
  const mutationPending = useRef(false);
  const held =
    cart?.lines.nodes.some((line) => !launchPurchaseAllowed(line.merchandise.product)) ?? false;
  const load = useCallback(async () => {
    if (mutationPending.current) return;
    const version = ++loadVersion.current;
    try {
      const response = await fetch('/api/commerce/cart', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Cart unavailable.');
      if (version !== loadVersion.current) return;
      setCart(data.cart);
      setError('');
    } catch {
      if (version !== loadVersion.current) return;
      setError('Cart is temporarily unavailable.');
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    queueMicrotask(() => void load());
    const updated = () => {
      setOpen(true);
      void load();
    };
    window.addEventListener('gent-ascend-cart-updated', updated);
    return () => window.removeEventListener('gent-ascend-cart-updated', updated);
  }, [load]);
  useEffect(() => {
    if (!open || fullPage) return;
    closeButton.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
      if (event.key === 'Tab') {
        const focusable = document.querySelectorAll<HTMLElement>(
          '#commerce-drawer button:not(:disabled), #commerce-drawer a, #commerce-drawer select',
        );
        const first = focusable[0],
          last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  }, [open, fullPage]);
  async function change(action: 'update' | 'remove', lineId: string, quantity?: number) {
    if (mutationPending.current) return;
    mutationPending.current = true;
    ++loadVersion.current;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/commerce/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, lineId, quantity }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to update cart.');
      setCart(result.cart);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update cart.');
    } finally {
      mutationPending.current = false;
      setBusy(false);
      setLoading(false);
    }
  }
  const contents = (
    <>
      <div className="cart-heading">
        <div>
          <span className="world-kicker">Your selection</span>
          <h2>Cart.</h2>
          <p>Review what earns a place in your ritual.</p>
        </div>
        {!fullPage && (
          <button
            type="button"
            ref={closeButton}
            onClick={() => {
              setOpen(false);
              trigger.current?.focus();
            }}
            aria-label="Close cart"
          >
            ✕
          </button>
        )}
      </div>
      {notice && (
        <p className="cart-error" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="cart-error" role="alert">
          {error}{' '}
          <button type="button" onClick={() => void load()}>
            Retry
          </button>
        </p>
      )}
      {loading ? (
        <p role="status">Loading your selection…</p>
      ) : !cart?.lines.nodes.length ? (
        <div className="cart-empty">
          <p>Your cart is ready when you are.</p>
          <Link href={basePath} onClick={() => setOpen(false)}>
            Explore the collection ↗
          </Link>
        </div>
      ) : (
        <>
          {held && (
            <div className="reserve-cart-review" role="status">
              <strong>Your selection needs a small adjustment.</strong>
              <p>
                Items marked below are not open for ordering. Remove them to continue with the rest
                of your selection.
              </p>
            </div>
          )}
          <ul className="cart-lines">
            {cart.lines.nodes.map((line) => (
              <li key={line.id}>
                {line.merchandise.product.featuredImage && (
                  <Image
                    src={line.merchandise.product.featuredImage.url}
                    alt={line.merchandise.product.featuredImage.altText ?? ''}
                    width={96}
                    height={112}
                  />
                )}
                <div>
                  <Link
                    href={`${basePath}/${line.merchandise.product.handle}`}
                    onClick={() => setOpen(false)}
                  >
                    {line.merchandise.product.title}
                  </Link>
                  <span>{line.merchandise.title}</span>
                  {!launchPurchaseAllowed(line.merchandise.product) && (
                    <p className="cart-error">
                      {launchLabel(line.merchandise.product)} · Remove this item to continue.
                    </p>
                  )}
                  <strong>{formatMoney(line.cost.totalAmount)}</strong>
                  <div className="cart-line-actions">
                    <label>
                      Quantity{' '}
                      <select
                        value={line.quantity}
                        disabled={busy || held}
                        onChange={(event) =>
                          void change('update', line.id, Number(event.target.value))
                        }
                      >
                        {Array.from({ length: Math.max(10, line.quantity) }, (_, i) => i + 1).map(
                          (n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                    <button
                      type="button"
                      aria-label={`Remove ${line.merchandise.product.title} from cart`}
                      disabled={busy}
                      onClick={() => void change('remove', line.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="cart-foot">
            <div>
              <span>Subtotal</span>
              <strong>{formatMoney(cart.cost.subtotalAmount)}</strong>
            </div>
            {cart.warnings?.map((warning, index) => (
              <p key={`${warning.code}-${index}`} className="cart-error" role="status">
                {warning.message}
              </p>
            ))}
            <p>
              Shipping, taxes, and any eligible discounts are confirmed at Shopify checkout. This
              subtotal is not the final order total.
            </p>
            {held ? (
              <p className="cart-error" role="status">
                An item is not open for ordering. Remove it to continue checkout.
              </p>
            ) : (
              <a
                className="world-button"
                href="/checkout"
                rel="nofollow"
                aria-disabled={busy || Boolean(error)}
                onClick={(event) => {
                  if (busy || error) event.preventDefault();
                  else commerceEvent('checkout_start');
                }}
              >
                Continue to secure checkout ↗
              </a>
            )}
            <Link href={basePath} onClick={() => setOpen(false)}>
              Continue exploring ↗
            </Link>
            <Link href={`${basePath}?saved=1`} onClick={() => setOpen(false)}>
              Review your saved collection ↗
            </Link>
          </div>
        </>
      )}
    </>
  );
  const Container = basePath === '/shop' ? 'main' : 'div';
  if (fullPage)
    return (
      <Container id="world-main" className="cart-page">
        {contents}
      </Container>
    );
  return (
    <>
      <button
        className="commerce-cart-trigger"
        ref={trigger}
        type="button"
        onClick={() => {
          setOpen(true);
          void load();
        }}
        aria-label={`Open cart${cart?.totalQuantity ? `, ${cart.totalQuantity} items` : ''}`}
      >
        Cart <span>{cart?.totalQuantity ?? 0}</span>
      </button>
      {open && (
        <div
          className="cart-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setOpen(false);
              trigger.current?.focus();
            }
          }}
        >
          <aside
            id="commerce-drawer"
            className="cart-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Your cart"
          >
            {contents}
          </aside>
        </div>
      )}
    </>
  );
}
