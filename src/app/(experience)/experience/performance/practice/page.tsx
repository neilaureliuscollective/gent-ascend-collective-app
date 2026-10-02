import Link from 'next/link';
import { GuestPractice } from '@/components/world/guest-practice';
import { PerformanceWorkspace } from '@/components/performance/workspace';
import { readPerformance } from '@/domains/performance/service';
import '@/app/(workspace)/app/performance/performance.css';
export const dynamic = 'force-dynamic';
export default async function Practice() {
  const data = await readPerformance().catch(() => null);
  return (
    <section className="gw-practice">
      <Link className="gw-return" href="/experience/performance">
        ← Performance World
      </Link>
      {data ? (
        <>
          <p className="gw-muted">
            {data.mode === 'personal'
              ? 'Your connected Performance workspace.'
              : 'Sample workspace — fictional records, not your personal history.'}
          </p>
          {data.mode === 'personal' ? <PerformanceWorkspace initial={data} /> : <GuestPractice />}
        </>
      ) : (
        <>
          <h1 tabIndex={-1}>Your practice is waiting.</h1>
          <p>We could not load your records. Reconnect and retry.</p>
          <Link className="gw-action" href="/experience/performance/practice">
            Retry
          </Link>
          <a href="/performance-offline.html">Open saved workout</a>
        </>
      )}
    </section>
  );
}
