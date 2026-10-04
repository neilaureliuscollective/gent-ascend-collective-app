import { ProductPage } from '@/components/commerce/product-page';
export const metadata = { title: 'The Collection', robots: { index: false, follow: false } };
export default async function MemberProduct({ params }: { params: Promise<{ handle: string }> }) {
  return <ProductPage handle={(await params).handle} basePath="/app/collection" />;
}
