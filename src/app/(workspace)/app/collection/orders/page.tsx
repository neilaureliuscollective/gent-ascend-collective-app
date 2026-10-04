import { CustomerOrders } from '@/components/commerce/customer-orders';
import { customerOrdersWorkspace } from '@/domains/commerce/customer-workspace';
import '../collection.css';
export const metadata = {
  title: 'Your orders | Gent Ascend',
  robots: { index: false, follow: false },
};
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ connection?: string }>;
}) {
  const [view, params] = await Promise.all([customerOrdersWorkspace(), searchParams]);
  return (
    <CustomerOrders
      view={view}
      failed={params.connection === 'failed' || params.connection === 'unavailable'}
    />
  );
}
