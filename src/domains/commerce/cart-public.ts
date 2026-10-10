import type { Cart } from './shopify';

export type PublicCart = Omit<Cart, 'id' | 'checkoutUrl'>;
export function publicCart(cart: Cart | null): PublicCart | null {
  if (!cart) return null;
  // A Shopify cart ID contains a secret key. Checkout is a server handoff.
  return {
    totalQuantity: cart.totalQuantity,
    cost: cart.cost,
    lines: cart.lines,
    warnings: cart.warnings,
  };
}

export function verifiedCheckoutUrl(value: string, hosts: readonly string[]) {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    !hosts.includes(url.hostname)
  )
    throw new Error('Unexpected checkout destination');
  return url;
}
