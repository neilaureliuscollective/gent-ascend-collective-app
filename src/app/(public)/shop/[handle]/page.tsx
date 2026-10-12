import { ProductPage } from '@/components/commerce/product-page';
export const metadata = { title: 'Product — Aethelios Lifestyle' };
export default async function Product({ params }: { params: Promise<{ handle: string }> }) {
  return <ProductPage handle={(await params).handle} basePath="/shop" liveOnly />;
}
