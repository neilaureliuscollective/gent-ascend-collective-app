import { CartPanel } from '@/components/commerce/cart-panel';
export const metadata = {
  title: 'Your cart — Aethelios Lifestyle',
  robots: { index: false, follow: false },
};
export default async function Cart({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string; error?: string; launch?: string }>;
}) {
  const query = await searchParams;
  const notice = query.expired
    ? 'Your earlier cart expired. Add a product to start a new cart.'
    : query.error
      ? 'Checkout could not open. Refresh your cart and try again.'
      : query.launch
        ? 'An item is no longer open for ordering. Remove it before checkout.'
        : undefined;
  return <CartPanel fullPage basePath="/app/collection" notice={notice} />;
}
