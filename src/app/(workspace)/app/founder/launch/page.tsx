import Link from 'next/link';
import { readReleaseReadiness } from '@/domains/release/service';
import { SavedWorkReadiness } from '@/components/missions/saved-work-readiness';
export const dynamic = 'force-dynamic';
export default async function ReleaseReadiness() {
  const report = await readReleaseReadiness();
  if (!report)
    return (
      <section className="panel">
        <h1>Founder access required.</h1>
        <Link className="text-link" href="/app/you">
          Go to your account →
        </Link>
      </section>
    );
  return (
    <>
      <div className="page-heading compact-heading">
        <div>
          <p className="eyebrow">Founder / Public release</p>
          <h1>The launch ledger.</h1>
        </div>
      </div>
      <section className="panel">
        <h2>Configured is the starting point.</h2>
        <p>
          These checks describe the current environment. Live acceptance remains open until its
          evidence is recorded. No launch approval or readiness score is inferred.
        </p>
        <p style={{ overflowWrap: 'anywhere' }}>
          Deployment source: {report.source ?? 'Unavailable in this environment'}
        </p>
        <Link className="text-link" href="/app/membership">
          Inspect billing configuration →
        </Link>
      </section>
      <SavedWorkReadiness report={report.savedWork} />
      <div className="personal-grid">
        {report.checks.map((check) => (
          <section className="panel" key={check.name}>
            <p className="eyebrow">{check.status}</p>
            <h2>{check.name}</h2>
            <p>{check.next}</p>
          </section>
        ))}
      </div>
      <div className="world-actions">
        <Link className="text-link" href="/support">
          View member support →
        </Link>
        <Link className="text-link" href="/app/you">
          Back to your account →
        </Link>
      </div>
    </>
  );
}
