'use client';
import { BplusMaterial } from '@/components/visual/bplus-material';
import { useEffect, useState } from 'react';
import type {
  ConstructBrief,
  ConstructEvent,
  ConstructRun,
  SourceSnapshot,
} from '@/domains/architect-construct/schema';
import {
  cancelConstructRun,
  readConstructLibrary,
  startConstructFixture,
} from './construct-lifecycle';
import { lifecycleLabel, lifecyclePhase } from '@/domains/architect-construct/lifecycle';

const views = ['Plan', 'Changes', 'Checks', 'Preview'] as const;
type View = (typeof views)[number];

type Library = {
  project: { id: string; revision: number; name: string };
  runs: ConstructRun[];
  events: Record<string, ConstructEvent[]>;
  briefs: ConstructBrief[];
  sources: SourceSnapshot[];
  proposal?: { mode?: string; reason?: string | null };
};

function statusLabel(status: ConstructRun['status']) {
  return status.replace('_', ' ');
}

export function ArchitectConstructPanel({
  projectId,
  revision,
  enabled,
  locked,
}: {
  projectId: string;
  revision: number;
  enabled: boolean;
  locked: boolean;
}) {
  const [view, setView] = useState<View>('Plan');
  const [library, setLibrary] = useState<Library | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [requestId, setRequestId] = useState('');
  const run = library?.runs[0] ?? null;
  const brief = run ? library?.briefs.find((row) => row.id === run.brief_id) : library?.briefs[0];
  const source = run ? library?.sources.find((row) => row.id === run.source_id) : library?.sources[0];
  const events = run ? (library?.events[run.id] ?? []) : [];

  async function refresh() {
    if (!enabled) return;
    const data = await readConstructLibrary(projectId);
    if (!data.ok) throw new Error(data.error);
    setLibrary(data.data as Library);
  }

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    fetch(`/api/architect-construct?project=${projectId}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Construct receipts unavailable.');
        return data as Library;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setLibrary(data);
        setMessage('Construct receipts are owner-scoped and not invented by the browser.');
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : 'Construct receipts unavailable.');
      });
    return () => controller.abort();
  }, [enabled, projectId, revision]);

  useEffect(() => {
    if (!enabled || !run || !['queued', 'claimed', 'running'].includes(run.status)) return;
    const timer = window.setInterval(() => {
      void fetch(`/api/architect-construct?project=${projectId}`, { cache: 'no-store' })
        .then(async (response) => {
          const data = await response.json();
          if (response.ok) setLibrary(data as Library);
        })
        .catch(() => undefined);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [enabled, projectId, run]);

  async function startFixture() {
    if (locked || busy) return;
    setBusy(true);
    setError('');
    const id = requestId || crypto.randomUUID();
    setRequestId(id);
    try {
      const started = await startConstructFixture({
        projectId,
        requestId: id,
        expected: revision,
      });
      if (!started.ok) throw new Error(started.error);
      setMessage(
        'Fixture run queued. The browser cannot mark checks passed. A local worker must claim the run.',
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the fixture run.');
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!run || locked || busy) return;
    setBusy(true);
    try {
      const canceled = await cancelConstructRun({ projectId, runId: run.id });
      if (!canceled.ok) throw new Error(canceled.error);
      setMessage('Cancellation requested. An uncertain paid operation will not be replayed.');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not cancel the run.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="origin-construct">
      <h3>Construct</h3>
      <p>
        Request a source-pinned execution, review the real diff and checks, then inspect isolated
        preview output. This lane does not invent repository files or mark a release complete.
      </p>
      {!enabled && (
        <p className="origin-notice">
          Execution persistence is off in this environment. Origin editing remains available. No
          simulated success is shown as a live run.
        </p>
      )}
      <div role="status" className="origin-status" aria-live="polite">
        {busy ? 'Construct request in progress. ' : ''}
        {message}
      </div>
      {error && (
        <div role="alert" className="origin-notice">
          <p>{error}</p>
        </div>
      )}
      <div className="origin-construct-actions">
        <button
          className="button"
          data-bplus-surface="action"
          disabled={!enabled || locked || busy}
          onClick={() => void startFixture()}
        >
          <BplusMaterial radius={8} />
          Queue labelled fixture run
        </button>
        <button disabled={!enabled || locked || busy || !run} onClick={() => void refresh()}>
          Reload receipts
        </button>
        <button
          disabled={!enabled || locked || busy || !run || ['succeeded', 'failed', 'cancelled', 'blocked', 'timed_out'].includes(run?.status ?? '')}
          onClick={() => void cancel()}
        >
          Cancel run
        </button>
      </div>
      <nav className="origin-construct-views" aria-label="Construct review">
        {views.map((tab) => (
          <button
            key={tab}
            aria-current={view === tab ? 'page' : undefined}
            data-bplus-surface={view === tab ? 'selection' : undefined}
            onClick={() => setView(tab)}
          >
            {view === tab && <BplusMaterial radius={8} />}
            {tab}
          </button>
        ))}
      </nav>
      {view === 'Plan' && (
        <article className="origin-construct-pane">
          <h4>Approved brief and exact source basis</h4>
          {source ? (
            <p>
              <strong>{source.kind}</strong> — {source.label}
            </p>
          ) : (
            <p>No source snapshot is attached. Missing source is a blocker, not invented knowledge.</p>
          )}
          {brief ? (
            <>
              <p>
                Project revision {brief.scope.project_revision}. Approval {brief.status}. Repository{' '}
                {brief.scope.repository ?? 'unspecified'}.
              </p>
              <p>{brief.scope.intended_change}</p>
              <p>Allowed paths: {brief.scope.allowed_paths.join(', ')}</p>
              <p>Protected paths: {brief.scope.protected_paths.join(', ')}</p>
              <p>
                Limits: {brief.scope.resource_limits.timeout_ms}ms timeout,{' '}
                {brief.scope.resource_limits.max_files} files.
              </p>
            </>
          ) : (
            <p>No approved brief for this project yet. Queue the labelled fixture to pin one.</p>
          )}
          {run && (
            <p>
              Latest run {statusLabel(run.status)} · {lifecycleLabel(lifecyclePhase(run.status))}
              {run.result?.blocker ? ` — ${run.result.blocker}` : ''}.
            </p>
          )}
          {library?.proposal?.mode === 'mock' && (
            <p>Labelled mocked provider is available. This is not a paid OpenAI call.</p>
          )}
          {run?.result?.isolation === 'process-fixture' && (
            <p>Labelled fixture test output — not an isolated AI build.</p>
          )}
          {events.length > 0 && (
            <ol>
              {events.map((event) => (
                <li key={event.id}>
                  {event.kind}: {event.detail}
                </li>
              ))}
            </ol>
          )}
        </article>
      )}
      {view === 'Changes' && (
        <article className="origin-construct-pane">
          <h4>Actual files and diffs</h4>
          {run?.result?.changed_files.length ? (
            <>
              <p>{run.result.changed_files.join(', ')}</p>
              <pre>{run.result.diff || 'No textual diff was collected.'}</pre>
            </>
          ) : (
            <p>
              {run?.result?.blocker ||
                'No execution result yet. Queued runs do not display a simulated diff.'}
            </p>
          )}
        </article>
      )}
      {view === 'Checks' && (
        <article className="origin-construct-pane">
          <h4>Actual commands</h4>
          {run?.result?.checks.length ? (
            <ul>
              {run.result.checks.map((check) => (
                <li key={check.name}>
                  <strong>
                    {check.name}: {check.status}
                  </strong>
                  <p>
                    {check.command} · exit {check.exit_code}
                  </p>
                  {check.log ? <pre>{check.log}</pre> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p>Checks are not-run until a worker records real exit codes. The browser cannot forge them.</p>
          )}
        </article>
      )}
      {view === 'Preview' && (
        <article className="origin-construct-pane">
          <h4>Isolated preview</h4>
          {run?.result?.preview.body ? (
            <iframe
              title="Construct preview"
              sandbox=""
              srcDoc={run.result.preview.body}
              className="origin-construct-preview"
            />
          ) : (
            <p>
              {run?.result?.preview.unavailable_reason ||
                run?.result?.blocker ||
                'Preview is unavailable until isolated output is collected.'}
            </p>
          )}
          {run?.result && (
            <p>
              Isolation {run.result.isolation}. Runtime available{' '}
              {run.result.runtime_available ? 'yes' : 'no'}. Sandbox executed{' '}
              {run.result.sandbox ? 'yes' : 'no'}. A Docker probe is not a sandbox.
            </p>
          )}
        </article>
      )}
    </div>
  );
}
