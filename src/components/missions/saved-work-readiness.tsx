import Link from 'next/link';
import type { SavedWorkReport, SavedWorkRelation } from '@/domains/release/saved-work';

const labels: Record<SavedWorkRelation, string> = {
  intelligence_missions: 'Mission direction',
  mission_proposals: 'Reviewed direction proposals',
  mission_studio_links: 'Mission to Studio connections',
  mission_outputs: 'Pinned replies',
  mission_turn_context: 'Exact context receipts',
  mission_deliverables: 'Saved work products',
  mission_deliverable_versions: 'Document versions',
  mission_deliverable_summaries: 'Saved-work summaries',
};
const statuses = {
  accessible: 'Readable schema',
  unavailable: 'Schema unavailable',
  denied: 'Session access denied',
  unknown: 'Check incomplete',
};

export function SavedWorkReadiness({ report }: { report: SavedWorkReport }) {
  const accessible = report.checks.every((check) => check.status === 'accessible');
  return (
    <section className="panel" aria-labelledby="saved-work-readiness-heading">
      <p className="eyebrow">Saved-work foundation</p>
      <h2 id="saved-work-readiness-heading">
        {accessible
          ? 'The saved-work schema is reachable.'
          : 'Saved work needs release validation.'}
      </h2>
      <p>
        {accessible
          ? 'Your session can reach these relations. Writes, isolation, exports and live intelligence still need their acceptance receipts.'
          : 'Unavailable schema or denied access must be resolved before testing the new Mission and document flows.'}
      </p>
      <p>
        Checked in this environment: <time dateTime={report.checkedAt}>{report.checkedAt}</time>
      </p>
      <dl>
        {report.checks.map((check) => (
          <div key={check.relation} style={{ paddingBlock: '0.5rem' }}>
            <dt>{labels[check.relation]}</dt>
            <dd style={{ marginInlineStart: 0 }}>{statuses[check.status]}</dd>
          </div>
        ))}
      </dl>
      <p>
        This check reads no records and runs no model calls. It cannot apply migrations or approve a
        release.
      </p>
      <div className="world-actions">
        <Link className="text-link" href="/app/missions">
          Open Missions →
        </Link>
        <Link className="text-link" href="/app/library">
          Open saved work →
        </Link>
      </div>
    </section>
  );
}
