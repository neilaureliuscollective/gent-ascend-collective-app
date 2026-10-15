'use client';
import { noApplicableChecksLabel } from '@/domains/architect-construct/check-coverage';
import type { CheckPlan } from '@/domains/architect-construct/schema';

export type EvidenceCheck = {
  id?: string;
  name: string;
  command: string;
  target?: string;
  exit_code: number;
  status: 'passed' | 'failed' | 'blocked' | 'not-run';
  log: string;
};

function evidenceKey(check: Pick<EvidenceCheck, 'id' | 'name' | 'command' | 'target'>) {
  return check.id || (check.command && check.target ? `${check.command}:${check.target}` : check.name);
}

export type EvidenceCoverage = {
  no_applicable: boolean;
  preexisting_failures: string[];
  introduced_failures: string[];
  untested: string[];
  unsupported: { kind: string; reason: string }[];
  revision_note: string;
  comparison_note?: string;
};

export function CheckEvidence({
  plan,
  coverage,
  checks,
  baseline,
  selectedName,
  onSelect,
}: {
  plan: CheckPlan | null;
  coverage?: EvidenceCoverage | null;
  checks: EvidenceCheck[];
  baseline?: EvidenceCheck[];
  selectedName: string | null;
  onSelect: (name: string) => void;
}) {
  const selected =
    checks.find((check) => evidenceKey(check) === selectedName) ?? checks[0] ?? null;
  const label = plan ? noApplicableChecksLabel(plan) : coverage?.no_applicable
    ? 'No applicable checks available'
    : 'Check coverage';
  return (
    <section className="origin-check-evidence" aria-labelledby="architect-check-evidence">
      <h4 id="architect-check-evidence">Check coverage</h4>
      <p>
        {label}. A check can pass while behavior remains untested.
        {coverage?.revision_note ? ` Revision ${coverage.revision_note}.` : ''}
      </p>
      {coverage?.comparison_note && (
        <p className="origin-understand-warning">{coverage.comparison_note}</p>
      )}
      {plan?.no_applicable && (
        <p>No applicable checks available. That is not a pass.</p>
      )}
      {plan && plan.applicable.length > 0 && (
        <ul>
          {plan.applicable.map((item) => (
            <li key={item.id ?? `${item.kind}:${item.target ?? item.name}`}>
              <strong>{item.kind}</strong> — {item.reason}
            </li>
          ))}
        </ul>
      )}
      {plan?.unsupported.map((item) => (
        <p key={item.kind}>
          {item.kind} unsupported: {item.reason}
        </p>
      ))}
      {coverage?.introduced_failures.length ? (
        <p className="origin-understand-warning">
          Introduced failures: {coverage.introduced_failures.join(', ')}.
        </p>
      ) : null}
      {coverage?.preexisting_failures.length ? (
        <p>Pre-existing failures: {coverage.preexisting_failures.join(', ')}.</p>
      ) : null}
      {checks.length ? (
        <ul className="origin-check-results">
          {checks.map((check) => (
            <li key={evidenceKey(check)}>
              <button
                type="button"
                aria-current={selected && evidenceKey(selected) === evidenceKey(check) ? 'true' : undefined}
                onClick={() => onSelect(evidenceKey(check))}
              >
                {check.name}: {check.status}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p>Checks are not-run until a worker records real exit codes. The browser cannot forge them.</p>
      )}
      {selected && (
        <article aria-label={`Evidence ${selected.name}`}>
          <p>
            <strong>
              {selected.name}: {selected.status}
            </strong>
          </p>
          <p>
            {selected.command} · exit {selected.exit_code}
            {baseline?.find((item) => evidenceKey(item) === evidenceKey(selected))
              ? ` · baseline ${baseline.find((item) => evidenceKey(item) === evidenceKey(selected))?.status}`
              : ''}
          </p>
          {selected.log ? <pre>{selected.log}</pre> : null}
        </article>
      )}
      {coverage?.untested.length ? (
        <p>Still untested: {coverage.untested.join('; ')}.</p>
      ) : null}
    </section>
  );
}
