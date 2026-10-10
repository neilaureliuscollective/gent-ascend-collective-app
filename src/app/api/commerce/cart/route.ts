import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  addLine,
  commerceConfigured,
  createCart,
  getCart,
  removeLine,
  updateLine,
  LaunchPurchaseError,
  cartLaunchPurchasable,
} from '@/domains/commerce/shopify';
import { cartId, clearCartId, saveCartId } from '@/domains/commerce/cart-session';

import { publicCart } from '@/domains/commerce/cart-public';

export const runtime = 'nodejs';
const input = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('add'),
    variantId: z.string().startsWith('gid://shopify/ProductVariant/').max(150),
    quantity: z.number().int().min(1).max(25),
  }),
  z.object({
    action: z.literal('update'),
    lineId: z.string().startsWith('gid://shopify/CartLine/').max(200),
    quantity: z.number().int().min(1).max(25),
  }),
  z.object({
    action: z.literal('remove'),
    lineId: z.string().startsWith('gid://shopify/CartLine/').max(200),
  }),
]);
const privateHeaders = { 'Cache-Control': 'private, no-store' };
const unavailable = () =>
  NextResponse.json(
    { error: 'Shopping is not open yet.' },
    { status: 503, headers: privateHeaders },
  );
const buyerIp = (request: NextRequest) =>
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();

export async function GET(request: NextRequest) {
  if (!commerceConfigured()) return unavailable();
  try {
    const id = await cartId();
    if (!id) return NextResponse.json({ cart: null }, { headers: privateHeaders });
    const cart = await getCart(id, buyerIp(request));
    if (!cart) await clearCartId();
    return NextResponse.json({ cart: publicCart(cart) }, { headers: privateHeaders });
  } catch {
    return NextResponse.json(
      { error: 'Cart is temporarily unavailable.' },
      { status: 502, headers: privateHeaders },
    );
  }
}

export async function POST(request: NextRequest) {
  if (!commerceConfigured()) return unavailable();
  if (request.headers.get('origin') !== request.nextUrl.origin)
    return NextResponse.json(
      { error: 'Invalid request origin.' },
      { status: 403, headers: privateHeaders },
    );
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: 'Invalid cart request.' },
      { status: 400, headers: privateHeaders },
    );
  try {
    const oldId = await cartId();
    const ip = buyerIp(request);
    const existing = oldId ? await getCart(oldId, ip) : null;
    if (!existing && oldId) await clearCartId();
    const action = parsed.data;
    if (existing && action.action !== 'remove' && !cartLaunchPurchasable(existing))
      return NextResponse.json(
        {
          error: 'Remove items that are not open for ordering before adding or updating your cart.',
        },
        { status: 409, headers: privateHeaders },
      );
    if (action.action !== 'add' && !existing)
      return NextResponse.json(
        { error: 'Your cart expired. Start a new cart.' },
        { status: 409, headers: privateHeaders },
      );
    // A missing/expired cart is replaced only on an explicit add. Shopify validates
    // variant availability and price, including changes since product-page render.
    const cart =
      action.action === 'add'
        ? existing
          ? await addLine(existing.id, action.variantId, action.quantity, ip)
          : await createCart(action.variantId, action.quantity, ip)
        : action.action === 'update'
          ? await updateLine(existing!.id, action.lineId, action.quantity, ip)
          : await removeLine(existing!.id, action.lineId, ip);
    await saveCartId(cart.id);
    return NextResponse.json({ cart: publicCart(cart) }, { headers: privateHeaders });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof LaunchPurchaseError
            ? error.message
            : 'Could not update the cart. Please retry.',
      },
      { status: error instanceof LaunchPurchaseError ? 409 : 502, headers: privateHeaders },
    );
  }
}
