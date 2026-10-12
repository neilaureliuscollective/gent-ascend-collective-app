import { redirect } from 'next/navigation';
import { currentFounderAccess } from '@/domains/access/founder';
export default async function Home() {
  const founder = await currentFounderAccess().catch(() => false);
  redirect(founder ? '/app/founder' : '/app/aethelios');
}
