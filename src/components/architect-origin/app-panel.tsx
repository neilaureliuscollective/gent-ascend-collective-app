'use client';

import { BplusMaterial } from '@/components/visual/bplus-material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { describeAppFailure } from '@/domains/architect-apps/generation-policy';
import { appWorkbenchStage, compactAppStatus } from '@/domains/architect-apps/stage';
import {
  acceptInspectMessage,
  applicationPlan,
  changeScopeForTarget,
  explainInspectTarget,
  inspectScopeForFiles,
  inspectTargets,
  revisionKind,
  type CreationBrief,
} from '@/domains/architect-origin/creation-journey';
import {
  approveArchitectApp,
  cancelArchitectApp,
  forwardAppData,
  proposeArchitectApp,
  readArchitectApps,
  reopenArchitectApp,
  startArchitectApp,
  type AppLibrary,
} from './app-lifecycle';

export type AppEditorDraft = { text: string; edited: boolean; binding: { revision: number | null; target: string | null } | null };

const panels = ['Plan', 'Files', 'Changes', 'Records', 'Revisions'] as const;

export function ArchitectAppPanel({
  ownerId,
  projectId,
  revision,
  enabled,
  locked,
  brief,
  briefText = '',
  editorDraft,
  onEditorDraft,
}: {
  ownerId: string;
  projectId: string;
  revision: number;
  enabled: boolean;
  locked: boolean;
  brief?: CreationBrief;
  briefText?: string;
  editorDraft?: AppEditorDraft;
  onEditorDraft?: (owner: string, project: string, snapshot: AppEditorDraft) => void;
}) {
  const resolvedBrief = useMemo<CreationBrief>(
    () =>
      brief ?? {
        path: 'application',
        idea: briefText,
        audience: '',
        constraints: '',
        outcome: '',
      },
    [brief, briefText],
  );
  const [library, setLibrary] = useState<AppLibrary | null>(null);
  const [proposal, setProposal] = useState<Record<string, unknown> | null>(null);
  const [viewport, setViewport] = useState<'desktop' | 'fold' | 'phone'>('desktop');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'conflict' | 'failed'>('idle');
  const [panel, setPanel] = useState<(typeof panels)[number]>('Files');
  const [refineOpen, setRefineOpen] = useState(false);
  const [interaction, setInteraction] = useState<'use' | 'inspect'>('use');
  const [inspectAction, setInspectAction] = useState<'explain' | 'change' | 'compare' | null>(null);
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [appSheet, setAppSheet] = useState<'stage' | 'side' | 'refine'>('stage');
  const [draft, setDraft] = useState(editorDraft?.text ?? (briefText.trim() || 'Create field notes I can save.'));
  const [draftBinding, setDraftBinding] = useState<{ revision: number | null; target: string | null } | null>(editorDraft?.binding ?? null);
  const [draftEdited, setDraftEdited] = useState(editorDraft?.edited ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selectedRevision, setSelectedRevision] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const knownInspectIds = useRef<string[]>([]);
  const seenInspectNonces = useRef<Set<string>>(new Set());
  const refineButton = useRef<HTMLButtonElement>(null);
  const detailsButton = useRef<HTMLButtonElement>(null);
  const requestField = useRef<HTMLTextAreaElement>(null);
  const scroll = useRef(0);
  const plane = useRef<HTMLDivElement>(null);
  const boundPreview = useRef({ session: '', generation: 0, revisionId: '', document: 0 });

  useEffect(() => {
    onEditorDraft?.(ownerId, projectId, { text: draft, edited: draftEdited, binding: draftBinding });
  }, [draft, draftEdited, draftBinding, onEditorDraft, ownerId, projectId]);

  const recovered = library?.pendingStart ?? null;
  const current = library?.current ?? null;
  const working = library?.working ?? null;
  const selected = library?.selected ?? null;
  const latestJob = library?.jobs[0] ?? null;
  const displayed = selected ?? (current?.status === 'ready' ? current : working);
  const preview = library?.preview ?? null;
  const displayedCollections =
    (library?.revisions.find((row) => row.revision === displayed?.revision)?.collections ?? [])
      .map((collection) => collection.name)
      .join(', ') || '';
  const workbench = appWorkbenchStage({
    job: latestJob,
    events: library?.events,
    preview,
    saveState,
  });

  async function refresh(nextSelected = selectedRevision) {
    const next = await readArchitectApps(projectId, nextSelected ?? undefined);
    setLibrary(next);
    return next;
  }

  const refreshHostState = useCallback(async () => {
    const next = await readArchitectApps(projectId, selectedRevision ?? undefined);
    setLibrary((current) => {
      if (!current) return next;
      const keepPreview =
        Boolean(current.preview?.srcDoc) &&
        current.preview?.revisionId === next.preview?.revisionId &&
        current.preview?.revision === next.preview?.revision;
      return {
        ...next,
        preview: keepPreview ? current.preview : next.preview,
        previewSession: keepPreview ? current.previewSession : next.previewSession,
      };
    });
    return next;
  }, [projectId, selectedRevision]);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void fetch(`/api/architect-apps?project=${projectId}${selectedRevision ? `&selected=${selectedRevision}` : ''}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = (await response.json()) as AppLibrary & { error?: string };
        if (!response.ok) throw new Error(data.error || 'Application library unavailable.');
        if (!controller.signal.aborted) setLibrary(data);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : 'Application library unavailable.');
      });
    return () => controller.abort();
  }, [enabled, ownerId, projectId, selectedRevision]);

  useEffect(() => {
    if (!latestJob || (latestJob.status !== 'queued' && latestJob.status !== 'running')) return;
    let active = true;
    const timer = window.setInterval(() => {
      void readArchitectApps(projectId, selectedRevision ?? undefined)
        .then((next) => { if (active) setLibrary(next); })
        .catch(() => undefined);
    }, 2000);
    return () => { active = false; window.clearInterval(timer); };
  }, [latestJob, projectId, selectedRevision]);

  useEffect(() => {
    const node = plane.current;
    if (node) node.scrollTop = scroll.current;
    return () => {
      if (node) scroll.current = node.scrollTop;
    };
  }, [panel, viewport, selectedFile]);

  useEffect(() => {
    boundPreview.current = {
      session: library?.previewSession ?? '',
      generation: preview?.generation ?? 0,
      revisionId: preview?.revisionId ?? '',
      document: boundPreview.current.document + 1,
    };
  }, [library?.previewSession, preview?.generation, preview?.revisionId, preview?.srcDoc]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== frame.current?.contentWindow) return;
      if (event.origin !== 'null' && event.origin !== window.location.origin) return;
      const data = event.data as {
        schema?: string;
        session?: string;
        requestId?: string;
        operation?: string;
        projectId?: string;
        revisionId?: string;
      };
      const snapshot = { ...boundPreview.current };
      const inspectIdAccepted = acceptInspectMessage(
        data,
        {
          session: snapshot.session,
          projectId,
          revisionId: snapshot.revisionId,
        },
        knownInspectIds.current,
        seenInspectNonces.current,
      );
      if (data && typeof data === 'object' && (data as { schema?: string }).schema === 'architect-apps-inspect/v1') {
        if (inspectIdAccepted) setInspectId(inspectIdAccepted);
        return;
      }
      if (!data || typeof data !== 'object' || data.schema !== 'architect-apps-data/v1' || !data.session) return;
      if (data.projectId && data.projectId !== projectId) return;
      if (data.revisionId && snapshot.revisionId && data.revisionId !== snapshot.revisionId) return;
      if (!snapshot.revisionId || data.session !== snapshot.session) return;
      const mutating = data.operation === 'create' || data.operation === 'update';
      if (mutating) setSaveState('saving');
      void forwardAppData(data, projectId, snapshot.revisionId)
        .then((result) => {
          if (
            boundPreview.current.document !== snapshot.document ||
            boundPreview.current.session !== snapshot.session ||
            boundPreview.current.revisionId !== snapshot.revisionId ||
            boundPreview.current.generation !== snapshot.generation
          )
            return;
          if (mutating) {
            const detail = typeof result.error === 'string' ? result.error : '';
            const failed = result.ok === false || Boolean(detail);
            setSaveState(/conflict|changed|identity/i.test(detail) ? 'conflict' : failed ? 'failed' : 'saved');
            if (!failed) void refreshHostState();
          }
          frame.current?.contentWindow?.postMessage({ schema: 'architect-apps-data/v1', ...result }, event.origin === 'null' ? '*' : event.origin);
        })
        .catch((reason: unknown) => {
          if (
            boundPreview.current.document !== snapshot.document ||
            boundPreview.current.session !== snapshot.session ||
            boundPreview.current.revisionId !== snapshot.revisionId ||
            boundPreview.current.generation !== snapshot.generation
          )
            return;
          const detail = reason instanceof Error ? reason.message : 'Host collection refused the request.';
          if (mutating) setSaveState(/conflict|changed|identity/i.test(detail) ? 'conflict' : 'failed');
          frame.current?.contentWindow?.postMessage(
            {
              schema: 'architect-apps-data/v1',
              requestId: data.requestId,
              ok: false,
              error: detail,
            },
            event.origin === 'null' ? '*' : event.origin,
          );
        });
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [projectId, refreshHostState]);

  const files = useMemo(() => {
    const row = library?.revisions.find((item) => item.revision === displayed?.revision) ?? library?.revisions.find((item) => item.id === current?.id);
    return row?.files.filter((file) => file.path.startsWith('src/')) ?? [];
  }, [library, displayed, current]);
  const selectedSource = files.find((file) => file.path === selectedFile) ?? files[0] ?? null;
  const parentFiles = useMemo(() => {
    const shown = library?.revisions.find((item) => item.revision === displayed?.revision);
    const parent = shown?.parent_revision;
    const row = library?.revisions.find((item) => item.revision === (parent === undefined ? (displayed?.revision ?? 0) - 1 : parent));
    return row?.files.filter((file) => file.path.startsWith('src/')) ?? [];
  }, [library, displayed]);
  const plan = useMemo(
    () =>
      applicationPlan({
        idea: resolvedBrief.idea || briefText,
        firstVisit: resolvedBrief.firstVisit,
        audience: resolvedBrief.audience,
        constraints: resolvedBrief.constraints,
        outcome: resolvedBrief.outcome,
        path: resolvedBrief.path,
        collections: displayedCollections ? displayedCollections.split(', ') : [],
      }),
    [resolvedBrief, briefText, displayedCollections],
  );
  const targets = useMemo(
    () =>
      inspectTargets({
        files,
        records: library?.records ?? {},
        plan,
        revision: displayed?.revision,
      }),
    [files, library?.records, plan, displayed?.revision],
  );
  const selectedTarget = targets.find((row) => row.id === inspectId) ?? targets[0] ?? null;
  const inspectScope = useMemo(() => inspectScopeForFiles(files), [files]);
  const retainedPreview =
    Boolean(preview) && (latestJob?.status === 'failed' || latestJob?.status === 'cancelled');
  const compactStatus = compactAppStatus({
    stage: workbench.stage,
    awaitingApproval: Boolean(proposal),
    blocked: Boolean(error && !preview) || library?.provider.enabled === false,
    retained: retainedPreview,
    uncertain: saveState === 'failed' || saveState === 'conflict',
    recovered: Boolean(recovered && workbench.stage === 'idle'),
    recoveredRevision: recovered?.revision,
  });
  useEffect(() => {
    knownInspectIds.current = targets.map((row) => row.id);
  }, [targets]);
  function setChangeRequest(open: boolean) {
    setRefineOpen(open);
    setAppSheet(open ? 'refine' : 'stage');
    window.requestAnimationFrame(() => {
      if (open) requestField.current?.focus();
      else refineButton.current?.focus();
    });
  }
  useEffect(() => {
    const node = frame.current?.contentWindow;
    if (!node || !preview) return;
    node.postMessage(
      {
        schema: 'architect-apps-inspect/v1',
        mode: interaction,
        session: library?.previewSession ?? '',
        projectId,
        revisionId: preview.revisionId,
      },
      '*',
    );
  }, [interaction, library?.previewSession, preview, projectId]);
  const fileDiffs = useMemo(() => {
    const proposedFiles = (proposal?.proposal as { files?: { path: string; content: string }[] } | undefined)?.files;
    const baseFiles = proposal ? library?.revisions.find((row) => row.revision === proposal.baseRevision)?.files ?? [] : parentFiles;
    const previous = new Map(baseFiles.filter((file) => file.path.startsWith('src/')).map((file) => [file.path, file.content]));
    const next = new Map((proposedFiles ?? files).map((file) => [file.path, file.content]));
    return [...new Set([...previous.keys(), ...next.keys()])]
      .sort()
      .map((path) => {
        const left = previous.get(path);
        const right = next.get(path);
        if (left == null && right != null) return { path, kind: 'create', before: '', after: right };
        if (left != null && right == null) return { path, kind: 'delete', before: left, after: '' };
        if (left !== right) return { path, kind: 'update', before: left ?? '', after: right ?? '' };
        return { path, kind: 'unchanged', before: left ?? '', after: right ?? '' };
      })
      .filter((row) => row.kind !== 'unchanged');
  }, [proposal, parentFiles, files, library]);

  async function propose() {
    setBusy(true);
    setError('');
    try {
      const next = await proposeArchitectApp({
        projectId,
        requestId: crypto.randomUUID(),
        expected: revision,
        instruction: draft.trim(),
        kind: library?.app ? 'revise' : 'create',
        baseRevision: draftBinding?.revision ?? displayed?.revision ?? library?.app?.current_revision,
        demo: library?.provider.mode === 'fixture' ? 'tracker' : 'none',
      });
      setProposal(next);
      setDraftEdited(false);
      setPanel('Changes');
      setRefineOpen(false);
      setAppSheet('side');
      setMessage('Reviewed files are shown before approval. Accepting a revision is not publishing.');
    } catch (reason) {
      setError(describeAppFailure(reason));
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!proposal) return;
    setBusy(true);
    setError('');
    try {
      const generation = proposal.generation as { mode: string; notes?: string };
      const approved = await approveArchitectApp({
        projectId,
        requestId: crypto.randomUUID(),
        expected: revision,
        approvalHash: proposal.approvalHash,
        proposal: proposal.proposal,
        generation,
        baseRevision: proposal.baseRevision ?? null,
      });
      setProposal(null);
      const next = await refresh();
      setMessage(
        `Revision ${approved.revision.revision} accepted. Start remains explicit. ${generation.mode === 'fixture' || generation.mode === 'mock' ? 'This is labelled development evidence, not a live model generation.' : ''}`,
      );
      if (next.pendingStart) setPanel('Files');
    } catch (reason) {
      setError(describeAppFailure(reason));
    } finally {
      setBusy(false);
    }
  }

  async function start(recoveredStart = recovered) {
    const pending = recoveredStart;
    if (!pending) return;
    setBusy(true);
    setError('');
    try {
      await startArchitectApp({
        projectId,
        revisionId: pending.revisionId,
        requestId: pending.requestId,
        expected: revision,
        approvalHash: pending.approvalHash,
      });
      await refresh();
      setMessage('Isolated build queued. An unsent refine draft is kept.');
    } catch (reason) {
      setError(describeAppFailure(reason));
    } finally {
      setBusy(false);
    }
  }

  async function reopen(rowRevision: number) {
    setBusy(true);
    setError('');
    try {
      const opened = await reopenArchitectApp(projectId, rowRevision);
      setSelectedRevision(opened.selectedRevision);
      setLibrary((currentLibrary) =>
        currentLibrary
          ? {
              ...currentLibrary,
              selected: opened.revision,
              previewSession: opened.session,
              preview: {
                srcDoc: opened.preview.srcDoc,
                sandbox: opened.preview.sandbox,
                label: opened.preview.label ?? `Private compiled preview of saved revision ${opened.selectedRevision}.`,
                revision: opened.preview.revision ?? opened.selectedRevision,
                revisionId: opened.preview.revisionId ?? opened.revision.id,
              },
            }
          : currentLibrary,
      );
      setMessage(`Showing saved revision ${opened.selectedRevision}. This is the selected compiled artifact, not a refresh of the latest build.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Revision could not be reopened.');
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) {
    return (
      <section className="architect-app" aria-label="Generated application">
        <p>Application creation is awaiting local enablement. Origin, Construct, Talk and Live stay unchanged.</p>
      </section>
    );
  }

  return (
    <section
      className="architect-app"
      aria-label="Generated application workbench"
      data-focus-room={preview ? 'true' : 'false'}
      data-interaction={interaction}
      data-app-sheet={appSheet}
    >
      <div className="architect-app-stage">
        <header className="architect-app-toolbar">
          <div>
            <p className="architect-app-kicker">Working application</p>
            <h3>
              {displayed ? `Revision ${displayed.revision}` : 'No application yet'}
              {selectedRevision && current && selectedRevision !== current.revision ? ` · selected, current ${current.revision}` : ''}
              {working && working.revision !== displayed?.revision ? ` · last working ${working.revision}` : ''}
            </h3>
            <section className="architect-app-status-region" aria-label="Application status">
              <p className="architect-app-status" data-stage={workbench.stage} aria-live="polite">
                {compactStatus}
              </p>
            </section>
            <details className="architect-app-status-details" aria-label="Build diagnostics">
              <summary>Build details</summary>
              <p>
                {library?.provider.enabled === false ? `${library.provider.reason} ` : ''}
                {library?.provider.mode === 'mock' || library?.provider.mode === 'fixture'
                  ? 'Labelled development generation is in use. '
                  : ''}
                {workbench.label}
                {displayed ? ` Running revision ${displayed.revision}.` : ''}
                {displayedCollections ? ` Data: ${displayedCollections}.` : ''}
                {preview?.revision && displayed && preview.revision !== displayed.revision
                  ? ` Preview still shows last working revision ${preview.revision}.`
                  : ''}
                {latestJob?.status === 'failed' && working
                  ? ' The attempted revision did not replace the last working application.'
                  : ''}
                {recovered && workbench.stage === 'idle' ? ` Approved revision ${recovered.revision} recovered. Start remains explicit.` : ''}
              </p>
              <ul className="architect-app-flags">
                {latestJob && (latestJob.status === 'queued' || latestJob.status === 'running') ? (
                  <li data-flag="build">Background build {latestJob.status}</li>
                ) : null}
                {library?.events.at(-1) ? (
                  <li data-flag="event">
                    {library.events.at(-1)!.kind}
                    {library.events.at(-1)!.detail ? ` · ${library.events.at(-1)!.detail.slice(0, 80)}` : ''}
                  </li>
                ) : null}
                {saveState === 'saving' ? <li data-flag="saving">Host save pending</li> : null}
                {saveState === 'saved' ? <li data-flag="saved">Record saved</li> : null}
                {saveState === 'conflict' ? <li data-flag="conflict">Reload before retry</li> : null}
                {saveState === 'failed' ? <li data-flag="uncertain">Retry keeps the same record</li> : null}
                {latestJob?.status === 'failed' && preview ? <li data-flag="retained">Last good preview kept</li> : null}
                {latestJob?.status === 'cancelled' && preview ? <li data-flag="retained">Last good preview kept</li> : null}
              </ul>
              <p className="architect-app-checks">
                Typecheck {latestJob?.result?.typecheck.ok ? 'passed' : latestJob ? 'pending or failed' : 'not run'} · Bundle{' '}
                {latestJob?.result?.bundle.ok ? 'passed' : latestJob ? 'pending or failed' : 'not run'} · Isolation{' '}
                {latestJob?.result?.isolation ?? 'none'} · Profile {library?.profile.toolchain}
                {preview?.revision ? ` · preview revision ${preview.revision}` : ''}
              </p>
            </details>
          </div>
          <div className="architect-app-viewports">
            <button type="button" aria-pressed={interaction === 'use'} onClick={() => setInteraction('use')}>
              Use
            </button>
            <button type="button" aria-pressed={interaction === 'inspect'} onClick={() => setInteraction('inspect')}>
              Inspect
            </button>
            <button type="button" aria-pressed={viewport === 'desktop'} onClick={() => setViewport('desktop')}>
              Desktop
            </button>
            <button type="button" aria-pressed={viewport === 'fold'} onClick={() => setViewport('fold')}>
              Fold
            </button>
            <button type="button" aria-pressed={viewport === 'phone'} onClick={() => setViewport('phone')}>
              Phone
            </button>
            <button
              type="button"
              ref={detailsButton}
              aria-pressed={appSheet === 'side'}
              onClick={() => {
                setAppSheet(appSheet === 'side' ? 'stage' : 'side');
                setRefineOpen(false);
              }}
            >
              Details
            </button>
            <button
              ref={refineButton}
              type="button"
              aria-expanded={refineOpen}
              aria-controls="architect-app-change-request"
              aria-pressed={refineOpen}
              onClick={() => setChangeRequest(!refineOpen)}
            >
              Request a change
            </button>
          </div>
        </header>
        <div className={`architect-app-frame architect-app-frame-${viewport}`} ref={plane} data-interaction={interaction}>
          {preview ? (
            <iframe
              ref={frame}
              title="Private generated application preview"
              sandbox={preview.sandbox}
              srcDoc={preview.srcDoc}
              style={interaction === 'inspect' && inspectScope !== 'elements' ? { pointerEvents: 'none' } : undefined}
            />
          ) : (
            <div className="architect-app-empty" data-schematic="true">
              <p>Labeled schematic — waiting for an approved isolated build. This is not a compiled preview.</p>
              <p>{library?.preview ? '' : 'Static document preview remains script-disabled on other surfaces.'}</p>
              <p>{briefText || 'No brief yet.'}</p>
            </div>
          )}
        </div>
        {interaction === 'inspect' ? (
          <section className="architect-app-inspect" aria-label="Selected application target">
            <p>
              {inspectScope === 'elements'
                ? 'This compiled preview can report verified element targets. Clicks map only to known files or records for this revision.'
                : 'This preview is not instrumented. Inspect uses host Files, Records and Plan. The painted interface is not selectable.'}{' '}
              {selectedTarget ? ` Selected: ${selectedTarget.title} · revision ${displayed?.revision ?? 'not built'}.` : ''}
            </p>
            <ol className="architect-app-targets">
              {targets.map((target) => (
                <li key={target.id}>
                  <button
                    type="button"
                    aria-current={selectedTarget?.id === target.id ? 'true' : undefined}
                    onClick={() => setInspectId(target.id)}
                  >
                    {target.title}
                    <small>{target.kind}</small>
                  </button>
                </li>
              ))}
            </ol>
            <div className="architect-app-inspect-actions">
              <button type="button" onClick={() => setInspectAction('explain')}>
                Explain
              </button>
              <button
                type="button"
                onClick={() => {
                  setInspectAction('change');
                  setChangeRequest(true);
                  if (selectedTarget && !draftEdited) {
                    setDraft(changeScopeForTarget(selectedTarget, displayed?.revision));
                    setDraftBinding({ revision: displayed?.revision ?? null, target: selectedTarget.title });
                  } else if (draftEdited) {
                    setMessage('Your unsent request and its revision are kept. Finish or clear it before choosing another target.');
                  }
                }}
              >
                Change
              </button>
              <button
                type="button"
                onClick={() => {
                  setInspectAction('compare');
                  setPanel('Changes');
                  setAppSheet('side');
                }}
              >
                Compare
              </button>
            </div>
            {inspectAction === 'explain' && selectedTarget ? <p>{explainInspectTarget(selectedTarget)}</p> : null}
            {inspectAction === 'compare' ? (
              fileDiffs.length ? (
                <ol className="architect-app-inspect-diff">
                  {fileDiffs.slice(0, 4).map((change) => (
                    <li key={change.path}>
                      <p>
                        {change.kind} <code>{change.path}</code>
                      </p>
                      {'before' in change ? <pre className="architect-app-diff-before">{String(change.before).slice(0, 400)}</pre> : null}
                      {'after' in change ? <pre className="architect-app-diff-after">{String(change.after).slice(0, 400)}</pre> : null}
                    </li>
                  ))}
                  <p>
                    Comparing current revision {current?.revision ?? 'none'}
                    {displayed && displayed.revision !== current?.revision
                      ? `, selected revision ${displayed.revision}`
                      : ''}
                    {proposal ? ' and the proposed files' : parentFiles.length ? ' with the previous saved files' : ''}.
                    Comparing does not restore or apply a revision.
                  </p>
                </ol>
              ) : (
                <p>No current/previous file difference is available to compare.</p>
              )
            ) : null}
          </section>
        ) : null}
      </div>
      <aside className="architect-app-side" aria-label="Application details">
        {appSheet === 'side' && <button type="button" onClick={() => { setAppSheet('stage'); detailsButton.current?.focus(); }}>Close details</button>}
        <div className="architect-app-tabs">
          {panels.map((tab) => (
            <button
              key={tab}
              type="button"
              aria-current={panel === tab ? 'page' : undefined}
              onClick={() => {
                setPanel(tab);
                if (tab === 'Records') void refreshHostState();
              }}
            >
              {tab}
            </button>
          ))}
        </div>
        {panel === 'Plan' && (
          <div className="architect-app-plan">
            <p>{plan.label}</p>
            {plan.firstVisit ? <p>First visit: {plan.firstVisit}</p> : null}
            {plan.audience ? <p>Audience: {plan.audience}</p> : null}
            <p>
              <strong>Screens</strong> {plan.screens.join(', ')}
            </p>
            <p>
              <strong>Actions</strong> {plan.actions.join(', ')}
            </p>
            <p>
              <strong>Data</strong> {plan.data.join(', ')}
            </p>
            <p>{plan.relationships}</p>
            {plan.unsupported.map((row) => (
              <p key={row}>{row}</p>
            ))}
            <p>Review, accept, start and publish stay distinct. Unsupported requirements stay listed before a commit.</p>
          </div>
        )}
        {panel === 'Files' && (
          <div className="architect-app-source">
            <ol>
              {files.map((file) => (
                <li key={file.path}>
                  <button type="button" aria-current={selectedSource?.path === file.path ? 'true' : undefined} onClick={() => setSelectedFile(file.path)}>
                    <code>{file.path}</code>
                  </button>
                </li>
              ))}
              {!files.length && <li>No generated files yet.</li>}
            </ol>
            {selectedSource ? <pre className="architect-app-source-view">{selectedSource.content}</pre> : null}
          </div>
        )}
        {panel === 'Changes' && (
          <section aria-label="Revision comparison">
          <h4>Revision comparison</h4>
          <p>{proposal ? `Revision ${displayed?.revision ?? 'none'} → proposed revision` : `Previous saved files → revision ${displayed?.revision ?? 'none'}`}</p>
          <ol>
            {fileDiffs.map((change) => (
              <li key={change.path}>
                <p>
                  {change.kind} <code>{change.path}</code>
                </p>
                {'before' in change && (change.kind === 'update' || change.kind === 'delete') ? (
                  <div><p>Before</p><pre className="architect-app-diff-before">{String(change.before)}</pre></div>
                ) : null}
                {'after' in change && (change.kind === 'update' || change.kind === 'create') ? (
                  <div><p>After</p><pre className="architect-app-diff-after">{String(change.after)}</pre></div>
                ) : null}
              </li>
            ))}
            {!fileDiffs.length && <li>No pending revision. Request a change to preview the file operations.</li>}
          </ol>
          </section>
        )}
        {panel === 'Records' && (
          <ol>
            {Object.entries(library?.records ?? {}).flatMap(([collection, rows]) =>
              rows.map((row) => (
                <li key={`${collection}:${String(row.id)}`} data-record-title={String(row.title ?? row.id)}>
                  {collection}: {String(row.title ?? row.id)}
                </li>
              )),
            )}
            {!Object.values(library?.records ?? {}).flat().length && <li>Records belong to the app and survive preview sessions.</li>}
          </ol>
        )}
        {panel === 'Revisions' && (
          <ol>
            {library?.revisions.map((row) => {
              const kind = revisionKind({
                status: row.status,
                working: row.working,
                current: current?.revision === row.revision,
                selected: displayed?.revision === row.revision,
                proposed: Boolean(proposal) && current?.revision === row.revision,
                failed: row.status === 'failed' || (latestJob?.status === 'failed' && latestJob.revision_id === row.id),
              });
              return (
                <li key={row.id} data-revision-kind={kind}>
                  {kind} · Revision {row.revision} · {row.status}
                  {row.working ? ' · last working' : ''}
                  {displayed?.revision === row.revision ? ' · showing' : ''}
                  {row.working ? (
                    <button type="button" aria-label={`Open verified revision ${row.revision}`} disabled={busy || locked || (row.status !== 'ready' && !row.working)} onClick={() => void reopen(row.revision)}>
                      Reopen
                    </button>
                  ) : (
                    <button type="button" aria-label={`Open verified revision ${row.revision}`} disabled={busy || locked || (row.status !== 'ready' && !row.working)} onClick={() => void reopen(row.revision)}>
                      View without restoring
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        <div className="architect-app-actions">
          {retainedPreview && working ? (
            <button type="button" disabled={busy || locked} onClick={() => void reopen(working.revision)}>
              Return to verified revision {working.revision}
            </button>
          ) : null}
          {proposal ? (
            <button className="button" disabled={busy || locked} onClick={() => void approve()}>
              <BplusMaterial radius={8} />
              Accept revision
            </button>
          ) : null}
          {recovered ? (
            <button className="button" disabled={busy || locked} onClick={() => void start(recovered)}>
              <BplusMaterial radius={8} />
              Start approved build
            </button>
          ) : null}
          {latestJob && (latestJob.status === 'queued' || latestJob.status === 'running') ? (
            <button disabled={busy} onClick={() => void cancelArchitectApp(projectId, latestJob.id).then(() => refresh())}>
              Cancel build
            </button>
          ) : null}
          <button disabled={busy} onClick={() => void refresh()}>
            Reload receipts
          </button>
        </div>
      </aside>
      <aside
        id="architect-app-change-request"
        className={`architect-app-refine${refineOpen ? ' is-open' : ''}`}
        hidden={!refineOpen}
        role="region"
        aria-label="Application change draft"
      >
        <button type="button" className="architect-app-refine-toggle" onClick={() => setChangeRequest(false)}>
          Close change draft
        </button>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void propose();
          }}
        >
          <label htmlFor="architect-app-change-draft">Request</label>
          <textarea
            id="architect-app-change-draft"
            ref={requestField}
            value={draft}
            onChange={(event) => {
              setDraft(event.currentTarget.value);
              setDraftEdited(Boolean(event.currentTarget.value.trim()));
              if (!draftEdited) setDraftBinding({ revision: displayed?.revision ?? null, target: selectedTarget?.title ?? null });
            }}
            maxLength={2000}
            disabled={busy || locked || latestJob?.status === 'running'}
          />
          <p>{draftBinding?.revision ?? displayed?.revision ? `Editing revision ${draftBinding?.revision ?? displayed?.revision}. ` : 'Creating from your saved brief. '}{draftBinding?.target ? `Target: ${draftBinding.target}. ` : ''}Unsent refine text is kept while a build runs. A later request does not mutate an already approved execution.</p>
          <button
            className="button"
            disabled={busy || locked || !library || !draft.trim() || library.provider.enabled === false}
          >
            <BplusMaterial radius={8} />
            Review proposed files
          </button>
        </form>
      </aside>
      {message ? <p role="status">{message}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
