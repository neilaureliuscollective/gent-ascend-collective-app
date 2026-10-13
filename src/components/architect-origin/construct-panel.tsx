'use client';
import { BplusMaterial } from '@/components/visual/bplus-material';
import { useEffect, useRef, useState } from 'react';
import type {
  ConstructBrief,
  ConstructEvent,
  ConstructRun,
  SourceSnapshot,
} from '@/domains/architect-construct/schema';
import {
  approveConstructChange,
  cancelConstructRun,
  proposeConstructChange,
  readConstructLibrary,
  readConstructSource,
  readPinnedConstructFile,
  sameConstructContext,
  selectCurrentRun,
  startConstructFixture,
  startConstructRun,
  type ConstructSourceReadiness,
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

type SourceFile = { path: string; content: string };
type ProposedChange = {
  mocked: boolean;
  summary: string;
  notes: string;
  patch: { path: string; before: string; after: string }[];
};

function statusLabel(status: ConstructRun['status']) {
  return status.replace('_', ' ');
}

function newId() {
  return crypto.randomUUID();
}

export function ArchitectConstructPanel({
  ownerId,
  projectId,
  revision,
  briefText,
  enabled,
  locked,
}: {
  ownerId: string;
  projectId: string;
  revision: number;
  briefText: string;
  enabled: boolean;
  locked: boolean;
}) {
  const [view, setView] = useState<View>('Plan');
  const [library, setLibrary] = useState<Library | null>(null);
  const [sourceReady, setSourceReady] = useState<ConstructSourceReadiness | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sourceKind, setSourceKind] = useState<'imported' | 'git'>('imported');
  const [commit, setCommit] = useState('');
  const [pinPaths, setPinPaths] = useState('preview.html');
  const [files, setFiles] = useState<SourceFile[]>([
    {
      path: 'preview.html',
      content:
        '<!doctype html><html lang="en"><title>Imported source</title><h1>Before</h1><p>Owner-supplied snapshot.</p></html>\n',
    },
  ]);
  const [intendedChange, setIntendedChange] = useState(briefText.slice(0, 2000));
  const [proposal, setProposal] = useState<ProposedChange | null>(null);
  const [approvedBriefId, setApprovedBriefId] = useState<string | null>(null);
  const generationRef = useRef(0);
  const run = selectCurrentRun(library, projectId, ownerId) as ConstructRun | null;
  const brief = run ? library?.briefs.find((row) => row.id === run.brief_id) : library?.briefs[0];
  const source = run ? library?.sources.find((row) => row.id === run.source_id) : library?.sources[0];
  const events = run ? (library?.events[run.id] ?? []) : [];

  function applyLibrary(
    next: Library,
    incoming: { ownerId: string; projectId: string; generation: number },
  ) {
    if (
      !sameConstructContext(
        { ownerId, projectId, generation: generationRef.current },
        incoming,
      )
    )
      return;
    if (next.project.id !== projectId) return;
    setLibrary(next);
  }

  async function refresh(signal?: AbortSignal) {
    if (!enabled) return;
    const incoming = { ownerId, projectId, generation: generationRef.current };
    const data = await readConstructLibrary(projectId, signal);
    if (!data.ok) throw new Error(data.error);
    applyLibrary(data.data as Library, incoming);
  }

  useEffect(() => {
    generationRef.current += 1;
    const generation = generationRef.current;
    const incoming = { ownerId, projectId, generation };
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
        applyLibrary(data, incoming);
        setMessage('Construct receipts are owner-scoped and not invented by the browser.');
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : 'Construct receipts unavailable.');
      });
    void readConstructSource(controller.signal).then((ready) => {
      if (controller.signal.aborted || !ready.ok) return;
      setSourceReady(ready.data);
    });
    return () => controller.abort();
    // applyLibrary closes over current project; remount/key plus generation drop late polls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ownerId, projectId, revision, briefText]);

  useEffect(() => {
    if (!enabled || !run || !['queued', 'claimed', 'running'].includes(run.status)) return;
    const incoming = { ownerId, projectId, generation: generationRef.current };
    const controller = new AbortController();
    const timer = window.setInterval(() => {
      void fetch(`/api/architect-construct?project=${projectId}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok || controller.signal.aborted) return;
          applyLibrary(data as Library, incoming);
        })
        .catch(() => undefined);
    }, 2500);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ownerId, projectId, run?.id, run?.status]);

  async function proposeChange() {
    if (locked || busy) return;
    setBusy(true);
    setError('');
    try {
      const paths = files.map((file) => file.path);
      const proposed = await proposeConstructChange({
        projectId,
        instruction: intendedChange,
        intendedChange,
        allowedPaths: paths,
        protectedPaths: ['.env'],
        excerpts: files,
      });
      if (!proposed.ok) throw new Error(proposed.error);
      setProposal({
        mocked: proposed.data.mocked,
        summary: proposed.data.proposal.summary,
        notes: proposed.data.proposal.notes,
        patch: proposed.data.proposal.patch,
      });
      setApprovedBriefId(null);
      setMessage(
        proposed.data.mocked
          ? 'Labelled mocked proposal ready for explicit approval. This is not a paid OpenAI call.'
          : 'Proposed change is ready for explicit approval. No run has been queued.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not propose a change.');
    } finally {
      setBusy(false);
    }
  }

  async function importPinned() {
    if (locked || busy || sourceKind !== 'git') return;
    setBusy(true);
    setError('');
    try {
      const sha = commit.trim();
      if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Pinned source reads require an exact commit.');
      const paths = pinPaths
        .split(',')
        .map((path) => path.trim())
        .filter(Boolean);
      const next: SourceFile[] = [];
      for (const path of paths) {
        const pinned = await readPinnedConstructFile(path, sha);
        if (!pinned.ok) throw new Error(pinned.error);
        next.push({ path: pinned.data.file.path, content: pinned.data.file.content });
      }
      if (!next.length) throw new Error('Source snapshot has no files. Missing source is a blocker.');
      setFiles(next);
      setMessage('Pinned files were imported read-only. Construct cannot commit or deploy.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Pinned source unavailable.');
    } finally {
      setBusy(false);
    }
  }

  async function approveChange() {
    if (locked || busy || !proposal) return;
    setBusy(true);
    setError('');
    try {
      const briefId = newId();
      const sourceId = newId();
      const repository = sourceReady?.github.repository?.fullName ?? null;
      const approved = await approveConstructChange({
        projectId,
        briefId,
        sourceId,
        expected: revision,
        sourceKind,
        repository: sourceKind === 'git' ? repository : null,
        commit: sourceKind === 'git' ? commit.trim() : null,
        files,
        intendedChange,
        allowedPaths: files.map((file) => file.path),
        protectedPaths: ['.env'],
        acceptanceChecks: files.some((file) => file.path.endsWith('.mjs') || file.path.endsWith('.js'))
          ? [{ name: 'syntax', command: 'node', args: ['--check', files.find((file) => file.path.endsWith('.mjs') || file.path.endsWith('.js'))!.path] }]
          : [{ name: 'present', command: 'true', args: [] }],
        patch: proposal.patch,
      });
      if (!approved.ok) throw new Error(approved.error);
      setApprovedBriefId(briefId);
      setMessage('Change approved against the pinned source. Enqueue it to start an isolated run.');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not approve the change.');
    } finally {
      setBusy(false);
    }
  }

  async function enqueueApproved() {
    if (locked || busy || !approvedBriefId) return;
    setBusy(true);
    setError('');
    try {
      const started = await startConstructRun({
        projectId,
        briefId: approvedBriefId,
        requestId: newId(),
        expected: revision,
      });
      if (!started.ok) throw new Error(started.error);
      setMessage('Approved change queued. The browser cannot mark checks passed.');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not enqueue the approved change.');
    } finally {
      setBusy(false);
    }
  }

  async function startFixture() {
    if (locked || busy) return;
    setBusy(true);
    setError('');
    try {
      const started = await startConstructFixture({
        projectId,
        requestId: newId(),
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
      <article className="origin-construct-pane">
        <h4>Authorized source and project brief</h4>
        <p>
          Connections access is read-only. Publishing and deployment stay unavailable.
          {sourceReady?.github.ready
            ? ` Selected repository ${sourceReady.github.repository?.fullName}.`
            : ` ${sourceReady?.github.reason || 'Imported files can still be approved without GitHub.'}`}
        </p>
        <label>
          Source kind
          <select
            value={sourceKind}
            disabled={!enabled || locked || busy}
            onChange={(e) => setSourceKind(e.target.value === 'git' ? 'git' : 'imported')}
          >
            <option value="imported">Imported snapshot</option>
            <option value="git">Git commit pin</option>
          </select>
        </label>
        {sourceKind === 'git' && (
          <>
            <label>
              Exact commit
              <input
                value={commit}
                disabled={!enabled || locked || busy}
                onChange={(e) => setCommit(e.target.value)}
                spellCheck={false}
                placeholder="40-character commit"
              />
            </label>
            <label>
              Pinned paths
              <input
                value={pinPaths}
                disabled={!enabled || locked || busy}
                onChange={(e) => setPinPaths(e.target.value)}
              />
            </label>
            <button disabled={!enabled || locked || busy} onClick={() => void importPinned()}>
              Import pinned files
            </button>
          </>
        )}
        {files.map((file, index) => (
          <fieldset key={`${file.path}:${index}`}>
            <legend>Source file {index + 1}</legend>
            <label>
              Path
              <input
                value={file.path}
                disabled={!enabled || locked || busy}
                onChange={(e) =>
                  setFiles((current) =>
                    current.map((row, rowIndex) =>
                      rowIndex === index ? { ...row, path: e.target.value } : row,
                    ),
                  )
                }
              />
            </label>
            <label>
              Content
              <textarea
                value={file.content}
                disabled={!enabled || locked || busy}
                rows={5}
                onChange={(e) =>
                  setFiles((current) =>
                    current.map((row, rowIndex) =>
                      rowIndex === index ? { ...row, content: e.target.value } : row,
                    ),
                  )
                }
              />
            </label>
          </fieldset>
        ))}
        <label>
          Intended change
          <textarea
            value={intendedChange}
            disabled={!enabled || locked || busy}
            rows={3}
            onChange={(e) => setIntendedChange(e.target.value)}
          />
        </label>
      </article>
      <div className="origin-construct-actions">
        <button
          className="button"
          data-bplus-surface="action"
          disabled={!enabled || locked || busy}
          onClick={() => void proposeChange()}
        >
          <BplusMaterial radius={8} />
          Propose change
        </button>
        <button disabled={!enabled || locked || busy || !proposal} onClick={() => void approveChange()}>
          Approve proposed change
        </button>
        <button
          disabled={!enabled || locked || busy || !approvedBriefId}
          onClick={() => void enqueueApproved()}
        >
          Enqueue approved change
        </button>
        <button
          disabled={!enabled || locked || busy}
          onClick={() => void startFixture()}
        >
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
      {proposal && (
        <article className="origin-construct-pane">
          <h4>Proposed change awaiting approval</h4>
          <p>{proposal.summary}</p>
          {proposal.mocked && <p>Labelled mocked provider. This is not a paid OpenAI call.</p>}
          <p>{proposal.notes}</p>
          {proposal.patch.map((file) => (
            <pre key={file.path}>
              {file.path}
              {'\n'}
              {file.after}
            </pre>
          ))}
        </article>
      )}
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
            <p>No approved brief for this project yet. Propose a change or queue the labelled fixture.</p>
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
