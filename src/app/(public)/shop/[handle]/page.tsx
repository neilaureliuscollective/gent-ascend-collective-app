import { ProductPage } from '@/components/commerce/product-page';
import { productMetadata } from '@/domains/commerce/product-metadata';
export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  return productMetadata((await params).handle);
}
export default async function Product({ params }: { params: Promise<{ handle: string }> }) {
  return <ProductPage handle={(await params).handle} basePath="/shop" liveOnly />;
}
