import { Threshold } from '@/components/world/threshold';
export default async function Entrance({
  searchParams,
}: {
  searchParams: Promise<{ replay?: string | string[] }>;
}) {
  const query = await searchParams;
  return <Threshold replay={query.replay === '1'} />;
}
