import Link from 'next/link';
import { PerformanceWorkspace } from '@/components/performance/workspace';
import { readPerformance } from '@/domains/performance/service';
import './performance.css';
export const metadata = { title: 'Ascend Performance | Aethelios' };
export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string }>;
}) {
  const space = (await searchParams).space;
  const initialView = space === 'fuel' || space === 'restore' ? space : 'today';
  const data = await readPerformance().catch(() => null);
  if (!data) {
    return (
      <section className="panel">
        <p className="eyebrow">Ascend Performance</p>
        <h1>Your records are waiting.</h1>
        <p>
          Performance could not connect. Retry when you are online. A saved workout can still be
          opened from the offline training page.
        </p>
        <Link className="button" href="/app/performance">
          Retry Performance
        </Link>
        <a className="text-link" href="/performance-offline.html">
          Open saved workout →
        </a>
      </section>
    );
  }
  return <PerformanceWorkspace initial={data} initialView={initialView} />;
}
