import { CartPanel } from '@/components/commerce/cart-panel';
export const metadata = { title: 'Your cart', robots: { index: false, follow: false } };
export default function Cart() {
  return <CartPanel fullPage basePath="/app/collection" />;
}
