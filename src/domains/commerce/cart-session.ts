import 'server-only';
import { cookies } from 'next/headers';

export const CART_COOKIE = 'gent_ascend_cart';
const MAX_AGE = 60 * 60 * 24 * 30;

export function validCartId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length < 1024 &&
    value.startsWith('gid://shopify/Cart/') &&
    value.includes('?key=')
  );
}

export async function cartId() {
  const value = (await cookies()).get(CART_COOKIE)?.value;
  return validCartId(value) ? value : null;
}

export async function saveCartId(value: string) {
  (await cookies()).set(CART_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function clearCartId() {
  (await cookies()).delete(CART_COOKIE);
}
