import type { Metadata } from 'next';
import { CartPanel } from '@/components/commerce/cart-panel';
export const metadata: Metadata = { title: 'Your cart', robots: { index: false, follow: false } };
export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string; error?: string; launch?: string }>;
}) {
  const query = await searchParams;
  const notice =
    query.launch === 'held'
      ? 'An item in your cart is not open for ordering. Remove it to continue checkout.'
      : query.expired
        ? 'Your earlier cart has expired. Please add your items again.'
        : query.error
          ? 'Checkout is temporarily unavailable. Please try again.'
          : undefined;
  return <CartPanel fullPage notice={notice} />;
}
