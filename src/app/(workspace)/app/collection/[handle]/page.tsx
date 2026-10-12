import { ProductPage } from '@/components/commerce/product-page';
export const metadata = {
  title: 'Product — Aethelios Lifestyle',
  robots: { index: false, follow: false },
};
export default async function LifestyleProduct({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  return <ProductPage handle={(await params).handle} basePath="/app/collection" liveOnly />;
}
