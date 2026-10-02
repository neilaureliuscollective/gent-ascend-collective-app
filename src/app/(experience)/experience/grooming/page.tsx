import { connection } from 'next/server';
import { GroomingWorld } from '@/components/world/grooming-world';
export const metadata = { title: 'Grooming world | Gent Ascend Collective' };
export default async function GroomingWorldPage() {
  await connection();
  return <GroomingWorld />;
}
