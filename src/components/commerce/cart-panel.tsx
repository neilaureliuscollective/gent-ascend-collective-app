'use client';
import Image from 'next/image';
import { commerceEvent } from './commerce-events';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PublicCart } from '@/domains/commerce/cart-public';
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
  const [cart, setCart] = useState<PublicCart | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const readController = useRef<AbortController | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const loadVersion = useRef(0);
  const mutationPending = useRef(false);
  const held =
    cart?.lines.nodes.some(
      (line) =>
        !launchPurchaseAllowed(line.merchandise.product) ||
        line.merchandise.availableForSale === false,
    ) ?? false;
  const load = useCallback(async () => {
    if (mutationPending.current) return;
    readController.current?.abort();
    const controller = new AbortController();
    readController.current = controller;
    const version = ++loadVersion.current;
    setLoading(true);
    try {
      const response = await fetch('/api/commerce/cart', {
        cache: 'no-store',
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Cart unavailable.');
      if (version !== loadVersion.current) return;
      setCart(data.cart);
      setError('');
    } catch {
      if (version !== loadVersion.current) return;
      setError('Cart is temporarily unavailable.');
    } finally {
      if (version === loadVersion.current) {
        readController.current = null;
        setLoading(false);
      }
    }
  }, []);
  const cancelRead = useCallback(() => {
    ++loadVersion.current;
    readController.current?.abort();
    readController.current = null;
  }, []);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void load();
    });
    const updated = () => {
      setOpen(true);
      void load();
    };
    window.addEventListener('gent-ascend-cart-updated', updated);
    return () => {
      window.removeEventListener('gent-ascend-cart-updated', updated);
      active = false;
      cancelRead();
    };
  }, [load, cancelRead]);
  useEffect(() => {
    if (!open || fullPage) return;
    const element = dialog.current;
    element?.showModal();
    closeButton.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
    };
  }, [open, fullPage]);
  useEffect(() => {
    if (!open) return;
    const refresh = () => {
      if (document.visibilityState === 'visible') void load();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [open, load]);
  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  async function change(action: 'update' | 'remove', lineId: string, quantity?: number) {
    if (mutationPending.current || readController.current || error) return;
    mutationPending.current = true;
    ++loadVersion.current;
    setBusy(true);
    setReceipt('');
    setError('');
    try {
      const response = await fetch('/api/commerce/cart', {
        signal: AbortSignal.timeout(20000),
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, lineId, quantity }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to update cart.');
      setCart(result.cart);
      setReceipt('Cart updated. Review the current quantities and subtotal.');
    } catch (reason) {
      setError(
        `${reason instanceof Error ? reason.message : 'Unable to update cart.'} Refresh the cart to confirm its current contents before making another change.`,
      );
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
          <button type="button" disabled={loading || busy} onClick={() => void load()}>
            Retry
          </button>
        </p>
      )}
      {loading && cart && <p role="status">Checking your current cart…</p>}
      {busy && <p role="status">Updating your cart…</p>}
      {receipt && <p role="status">{receipt}</p>}
      {loading && !cart ? (
        <p role="status">Loading your selection…</p>
      ) : error && !cart ? null : !cart?.lines.nodes.length ? (
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
                  {(!launchPurchaseAllowed(line.merchandise.product) ||
                    line.merchandise.availableForSale === false) && (
                    <p className="cart-error">
                      {line.merchandise.availableForSale === false
                        ? 'Currently unavailable'
                        : launchLabel(line.merchandise.product)}{' '}
                      · Remove this item to continue.
                    </p>
                  )}
                  <strong>{formatMoney(line.cost.totalAmount)}</strong>
                  <div className="cart-line-actions">
                    <button
                      type="button"
                      className="cart-quantity-step"
                      aria-label={`Decrease quantity of ${line.merchandise.product.title}`}
                      disabled={
                        busy ||
                        loading ||
                        held ||
                        Boolean(error) ||
                        line.quantity <= 1 ||
                        line.quantity > 26
                      }
                      onClick={() => void change('update', line.id, line.quantity - 1)}
                    >
                      −
                    </button>
                    <label>
                      Quantity{' '}
                      <select
                        value={line.quantity}
                        disabled={busy || loading || held || Boolean(error)}
                        onChange={(event) =>
                          void change('update', line.id, Number(event.target.value))
                        }
                      >
                        {Array.from({ length: 25 }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                        {line.quantity > 25 && (
                          <option value={line.quantity}>{line.quantity}</option>
                        )}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="cart-quantity-step"
                      aria-label={`Increase quantity of ${line.merchandise.product.title}`}
                      disabled={busy || loading || held || Boolean(error) || line.quantity >= 25}
                      onClick={() => void change('update', line.id, line.quantity + 1)}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${line.merchandise.product.title} from cart`}
                      disabled={busy || loading || Boolean(error)}
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
                href={busy || loading || error ? undefined : '/checkout'}
                role="link"
                tabIndex={busy || loading || error ? -1 : 0}
                rel="nofollow"
                aria-disabled={busy || loading || Boolean(error)}
                onClick={(event) => {
                  if (busy || loading || error || mutationPending.current || readController.current)
                    event.preventDefault();
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
      <dialog
        ref={dialog}
        id="commerce-drawer"
        className="cart-overlay cart-modal"
        aria-label="Your cart"
        onCancel={() => setOpen(false)}
        onClose={() => {
          setOpen(false);
          trigger.current?.focus();
        }}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div className="cart-drawer">{contents}</div>
      </dialog>
    </>
  );
}
