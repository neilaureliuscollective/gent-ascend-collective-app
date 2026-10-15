'use client';
import { useState } from 'react';
import {
  architectDiagnostics,
  architectUnavailableMessage,
} from '@/domains/health/architect-adapter';
import type { TrustedPresentation } from '@/domains/health/architect-adapter';
import type { HealthWorkspaceRecord } from '@/domains/health/workspace-model';

export function ArchitectWorkbench({
  workspace,
  blocked,
  onPresentation,
  onCompile,
  onAccept,
  onClose,
}: {
  workspace: HealthWorkspaceRecord;
  blocked: boolean;
  onPresentation: (next: TrustedPresentation) => void;
  onCompile: (instruction: string) => void;
  onAccept: () => void;
  onClose: () => void;
}) {
  const presentation = workspace.settings.presentation;
  const attempt = workspace.architect;
  const [instruction, setInstruction] = useState(
    'Add a date-range interaction and a compact comparison drawer.',
  );
  const diagnostics = architectDiagnostics();
  return (
    <div className="health-architect" data-foundation={workspace.foundation}>
      <header>
        <p className="health-kicker">Customize with Architect</p>
        <h2>{workspace.title}</h2>
        <p>
          Appearance and workflow change through trusted Health controls immediately. Isolated
          compile is used only for presentation, never for records or clinical rules.
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
        <label>
          What should change
          <textarea
            maxLength={2000}
            value={instruction}
            disabled={blocked}
            aria-label="Customization request"
            onChange={(e) => setInstruction(e.target.value)}
          />
        </label>
        <p data-architect-status={attempt?.status ?? 'idle'}>
          {attempt?.blocker || architectUnavailableMessage()}
        </p>
        <button disabled={blocked || !instruction.trim()} onClick={() => onCompile(instruction)}>
          Request isolated compile
        </button>
        {attempt?.status === 'ready' && attempt.isolation === 'docker' && attempt.previewOk && (
          <button disabled={blocked} onClick={onAccept}>
            Accept revision {attempt.attemptedRevision}
          </button>
        )}
        {attempt?.status === 'ready' &&
          attempt.isolation === 'docker' &&
          attempt.previewOk &&
          attempt.diff.length > 0 && (
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
        {attempt && attempt.status !== 'ready' && (
          <p>
            No verified generated artifact. Illustrative contract text is not a build receipt.
          </p>
        )}
        <p className="health-footnote">
          Working revision {workspace.lastWorkingRevision}. A failed or blocked compile does not
          replace it. Personal health values stay in Health.
        </p>
        <details data-health-diagnostics="architect">
          <summary>Technical details</summary>
          <p>
            Architect Apps PR #{diagnostics.pr} @ {diagnostics.commit}. Isolation must be Docker
            with a usable preview. Client revision metadata is not a verified build.
          </p>
        </details>
      </section>
    </div>
  );
}
