import 'server-only';
import { cookies } from 'next/headers';
import { authorizedPerson } from '@/domains/access/authorize';
import {
  ACCOUNT_COOKIE,
  customerConfig,
  customerSession,
  readCustomerOrders,
  type CustomerOrdersView,
} from './customer-account';
export async function customerOrdersWorkspace(): Promise<CustomerOrdersView> {
  const owner = await authorizedPerson('profile.read');
  if (!owner) return { state: 'signed-out' };
  const config = customerConfig();
  if (!config) return { state: 'unconfigured' };
  const session = customerSession(
    (await cookies()).get(ACCOUNT_COOKIE)?.value,
    owner.person.id,
    config,
  );
  if (!session) return { state: 'disconnected' };
  try {
    return await readCustomerOrders(session, config);
  } catch {
    return { state: 'unavailable' };
  }
}
