import Link from 'next/link';
import { studioReadiness } from '@/domains/studio/readiness-service';
import { currentFounderAccess } from '@/domains/access/founder';
import { notFound } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default async function StudioSetup() {
  if (!(await currentFounderAccess())) notFound();
  const report = await studioReadiness();
  return (
    <>
      <div className="page-heading compact-heading">
        <div>
          <p className="eyebrow">Founder / Studio activation</p>
          <h1>Connect the creative environment.</h1>
        </div>
      </div>
      <section className="panel">
        <h2>Detected is not verified live.</h2>
        <p>
          This report checks server configuration and expected database columns through your own
          session. It performs no provider calls, writes, generation or deployment. Private storage,
          RPC behavior, billing and two-account security need separate acceptance.
        </p>
        <Link className="text-link" href="/api/studio/readiness">
          Open private JSON report →
        </Link>
      </section>
      <div className="personal-grid">
        {[...report.configuration, ...report.schemas].map((check) => (
          <section className="panel" key={check.name}>
            <p className="eyebrow">{check.status}</p>
            <h2>{check.name}</h2>
            <p>{check.next}</p>
          </section>
        ))}
      </div>
      <section className="panel">
        <h2>Staging before activation.</h2>
        <ol>
          <li>
            Choose a separate protected staging database and preserve all pending Studio work.
          </li>
          <li>Review/apply compatible migrations and verify private buckets/RPC ownership.</li>
          <li>Set application credentials and budgets in the staging environment.</li>
          <li>
            Use ordinary login to approve one narration and one short clip; verify costs,
            save/reopen, recovery and another account’s denial.
          </li>
          <li>Complete device/visual acceptance before founder-approved production release.</li>
        </ol>
        <Link className="text-link" href="/app/studio">
          Return to Studio →
        </Link>
      </section>
    </>
  );
}
