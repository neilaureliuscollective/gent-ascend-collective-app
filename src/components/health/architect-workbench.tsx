'use client';
import {
  acceptArchitectAttempt,
  architectBlockedMessage,
  ARCHITECT_APPS_DEPENDENCY,
  requestArchitectRevision,
  type ArchitectAttempt,
} from '@/domains/health/architect-adapter';
import type { TrustedPresentation } from '@/domains/health/architect-adapter';
import type { HealthWorkspaceRecord } from '@/domains/health/workspace-model';

export function ArchitectWorkbench({
  workspace,
  blocked,
  onPresentation,
  onAttempt,
  onClose,
}: {
  workspace: HealthWorkspaceRecord;
  blocked: boolean;
  onPresentation: (next: TrustedPresentation) => void;
  onAttempt: (next: ArchitectAttempt) => void;
  onClose: () => void;
}) {
  const presentation = workspace.settings.presentation;
  const attempt = workspace.architect;
  return (
    <div className="health-architect" data-foundation={workspace.foundation}>
      <header>
        <p className="health-kicker">Customize with Architect</p>
        <h2>{workspace.title}</h2>
        <p>
          Appearance and workflow change through trusted Health controls immediately. Genuine source
          compilation uses Architect Apps PR #{ARCHITECT_APPS_DEPENDENCY.pr} @{' '}
          <code>{ARCHITECT_APPS_DEPENDENCY.commit.slice(0, 12)}</code>.
        </p>
        <button type="button" onClick={onClose}>
          Return to Health
        </button>
      </header>
      <fieldset disabled={blocked}>
        <legend>Trusted presentation</legend>
        <label>
          Density
          <select
            value={presentation.density}
            aria-label="Density"
            onChange={(e) =>
              onPresentation({
                ...presentation,
                density: e.target.value as TrustedPresentation['density'],
              })
            }
          >
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </select>
        </label>
        <label>
          Arrangement
          <select
            value={presentation.arrangement}
            aria-label="Arrangement"
            onChange={(e) =>
              onPresentation({
                ...presentation,
                arrangement: e.target.value as TrustedPresentation['arrangement'],
              })
            }
          >
            <option value="sequence">Sequence</option>
            <option value="timeline">Timeline</option>
            <option value="markers">Markers</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={presentation.dateRange}
            onChange={(e) => onPresentation({ ...presentation, dateRange: e.target.checked })}
          />
          Date-range interaction
        </label>
        <label>
          <input
            type="checkbox"
            checked={presentation.comparisonDrawer}
            onChange={(e) =>
              onPresentation({ ...presentation, comparisonDrawer: e.target.checked })
            }
          />
          Compact comparison drawer
        </label>
      </fieldset>
      <section>
        <p className="health-kicker">Source customization</p>
        <p data-architect-status={attempt?.status ?? 'idle'}>
          {attempt?.blocker || architectBlockedMessage()}
        </p>
        <button
          disabled={blocked}
          onClick={() =>
            void requestArchitectRevision({
              workspaceId: workspace.id,
              workingRevision: workspace.workingRevision,
              instruction: 'Add a date-range interaction and a compact comparison drawer.',
              presentation,
            }).then(onAttempt)
          }
        >
          Request isolated compile
        </button>
        {attempt?.status === 'ready' && (
          <button disabled={blocked} onClick={() => onAttempt(acceptArchitectAttempt(attempt))}>
            Accept revision {attempt.attemptedRevision}
          </button>
        )}
        {attempt && (
          <ol className="health-diff">
            {attempt.diff.map((row) => (
              <li key={row.path}>
                <code>{row.path}</code>
                <p>Before: {row.before}</p>
                <p>After: {row.after}</p>
              </li>
            ))}
          </ol>
        )}
        <p className="health-footnote">
          Working revision {workspace.lastWorkingRevision}. A failed or blocked compile does not
          replace it. Personal lab values are not sent to Architect.
        </p>
      </section>
    </div>
  );
}
