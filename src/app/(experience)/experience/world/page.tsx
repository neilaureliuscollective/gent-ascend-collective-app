import { redirect } from 'next/navigation';
export default async function LegacyWorld({ searchParams }: { searchParams: Promise<{ claim?: string }> }) {
  const { claim } = await searchParams;
  redirect(claim === '1' ? '/app/welcome?claim=1' : '/');
}
