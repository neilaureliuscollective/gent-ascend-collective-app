import type { Metadata } from 'next';
import { CartPanel } from '@/components/commerce/cart-panel';
export const metadata: Metadata = { title: 'Your cart', robots: { index: false, follow: false } };
export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string; error?: string }>;
}) {
  const query = await searchParams;
  const notice = query.expired
    ? 'Your earlier cart has expired. Please add your items again.'
    : query.error
      ? 'Checkout is temporarily unavailable. Please try again.'
      : undefined;
  return <CartPanel fullPage notice={notice} />;
}
