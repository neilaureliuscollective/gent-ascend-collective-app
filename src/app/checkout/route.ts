import { NextRequest, NextResponse } from 'next/server';
import { cartId, clearCartId } from '@/domains/commerce/cart-session';
import { cartLaunchPurchasable, commerceConfigured, getCart } from '@/domains/commerce/shopify';

import { verifiedCheckoutUrl } from '@/domains/commerce/cart-public';

export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
  if (!commerceConfigured()) return NextResponse.redirect(new URL('/app/lifestyle', request.url));
  const id = await cartId();
  if (!id) return NextResponse.redirect(new URL('/app/collection/cart', request.url));
  try {
    const cart = await getCart(id, request.headers.get('x-forwarded-for')?.split(',')[0]?.trim());
    if (!cart) {
      await clearCartId();
      return NextResponse.redirect(new URL('/app/collection/cart?expired=1', request.url));
    }
    if (!cart.totalQuantity || !cart.lines.nodes.length)
      return NextResponse.redirect(new URL('/app/collection/cart', request.url));
    if (!cartLaunchPurchasable(cart))
      return NextResponse.redirect(new URL('/app/collection/cart?launch=held', request.url));
    const store = process.env.SHOPIFY_STORE_DOMAIN!;
    const permitted = [store, 'checkout.shopify.com', process.env.SHOPIFY_CHECKOUT_HOST].filter(
      (host): host is string => Boolean(host),
    );
    const url = verifiedCheckoutUrl(cart.checkoutUrl, permitted);
    return NextResponse.redirect(url, {
      headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' },
    });
  } catch {
    return NextResponse.redirect(new URL('/app/collection/cart?error=1', request.url));
  }
}
