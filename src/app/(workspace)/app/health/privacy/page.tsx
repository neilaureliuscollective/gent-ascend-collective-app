import { HealthWorkspace } from '@/components/health/workspace';
import { readHealth } from '@/domains/health/service';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Health — Aethelios', robots: { index: false, follow: false } };
export default async function Page() {
  return <HealthWorkspace initial={await readHealth()} view="privacy" />;
}
