import { redirect } from 'next/navigation';
import { currentIdentity } from '@/domains/identity/current';
export const dynamic = 'force-dynamic';
export default async function Enter() {
  redirect((await currentIdentity()) ? '/app/welcome' : '/app/you');
}
