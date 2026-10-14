'use client';
import { BplusMaterial } from '@/components/visual/bplus-material';
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  CheckPlan,
  ConstructBrief,
  ConstructEvent,
  ConstructRun,
  SourceSnapshot,
} from '@/domains/architect-construct/schema';
import {
  approveConstructChange,
  approveConstructRepair,
  cancelConstructRun,
  proposeConstructChange,
  proposeConstructRepair,
  readConstructLibrary,
  readConstructSource,
  readPinnedConstructFile,
  constructInputSnapshot,
  sameConstructContext,
  selectCurrentRun,
  selectRepairJourney,
  selectRetainedConstructPreview,
  startConstructFixture,
  startConstructRun,
  type ConstructSourceReadiness,
} from './construct-lifecycle';
import { repairEligible } from '@/domains/architect-construct/repair-eligibility';
import { lifecycleLabel, lifecyclePhase } from '@/domains/architect-construct/lifecycle';
import {
  acceptanceChecksFromPlan,
  persistableCheckPlan,
  planCheckCoverage,
} from '@/domains/architect-construct/check-coverage';
import { effectiveProtectedPaths } from '@/domains/architect-construct/path-protection';
import { prepareSourceContext, type SourceContextManifest } from '@/domains/architect-construct/source-context';
import { ContextSheet } from '@/components/interaction/context-sheet';
import { SourceUnderstanding } from './source-understanding';
import { ChangeDiff } from './change-diff';
import { CheckEvidence } from './check-evidence';

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
  snapshot: string;
  context: SourceContextManifest;
  coverage: CheckPlan;
};

type BoundApproval = {
  briefId: string;
  sourceId: string;
  approvalHash: string;
  requestId: string;
  snapshot: string;
  revision: number;
  parentRunId?: string;
};

type RequestContext = {
  ownerId: string;
  projectId: string;
  revision: number;
  generation: number;
};

function statusLabel(status: ConstructRun['status']) {
  return status.replace('_', ' ');
}

function newId() {
  return crypto.randomUUID();
}

function fileFingerprint(files: SourceFile[]) {
  return JSON.stringify(
    [...files]
      .map((file) => ({ path: file.path, content: file.content }))
      .sort((a, b) => a.path.localeCompare(b.path)),
  );
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
  const [approval, setApproval] = useState<BoundApproval | null>(null);
  const [repairProposal, setRepairProposal] = useState<
    (ProposedChange & { parentRunId: string; combined: ProposedChange['patch']; targets: string[] }) | null
  >(null);
  const [repairApproval, setRepairApproval] = useState<BoundApproval | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [selectedChange, setSelectedChange] = useState<string | null>(null);
  const [selectedCheck, setSelectedCheck] = useState<string | null>(null);
  const [contextPanel, setContextPanel] = useState<'understand' | 'change' | 'evidence'>('understand');
  const [sheet, setSheet] = useState<'understand' | 'change' | 'evidence' | null>(null);
  const panelScrollRef = useRef<HTMLElement>(null);
  const panelScrollByView = useRef<Record<string, number>>({});
  const [gitPin, setGitPin] = useState<{
    repository: string;
    commit: string;
    files: string;
  } | null>(null);
  const fixtureKeyRef = useRef<{ key: string; id: string } | null>(null);
  const generationRef = useRef(0);
  const snapshot = constructInputSnapshot({
    sourceKind,
    repository: sourceKind === 'git' ? sourceReady?.github.repository?.fullName ?? null : null,
    commit,
    files,
    intendedChange,
    revision,
  });
  const localContext = useMemo(
    () =>
      prepareSourceContext({
        files,
        allowedPaths: files.map((file) => file.path),
        protectedPaths: effectiveProtectedPaths(),
        intendedChange,
      }),
    [files, intendedChange],
  );
  const localCoverage = useMemo(() => persistableCheckPlan(planCheckCoverage(files)), [files]);
  const liveProposal = proposal?.snapshot === snapshot ? proposal : null;
  const reviewContext = liveProposal?.context ?? localContext;
  const reviewCoverage = liveProposal?.coverage ?? localCoverage;
  const liveApproval =
    approval && approval.snapshot === snapshot && approval.revision === revision ? approval : null;
  const run = selectCurrentRun(library, projectId, ownerId) as ConstructRun | null;
  const retained = selectRetainedConstructPreview({
    library,
    ownerId,
    projectId,
  });
  const journeyView = selectRepairJourney({
    library,
    ownerId,
    projectId,
    localProposal: repairProposal,
    localApproval: repairApproval,
  });
  const original = (journeyView.original as ConstructRun | null) ?? null;
  const repairRun = (journeyView.repair as ConstructRun | null) ?? null;
  const resultRun = (repairRun ?? original) as ConstructRun | null;
  const brief = resultRun
    ? library?.briefs.find((row) => row.id === resultRun.brief_id)
    : original
      ? library?.briefs.find((row) => row.id === original.brief_id)
      : library?.briefs[0];
  const source = original
    ? library?.sources.find((row) => row.id === original.source_id)
    : run
      ? library?.sources.find((row) => row.id === run.source_id)
      : library?.sources[0];
  const events = resultRun ? (library?.events[resultRun.id] ?? []) : run ? (library?.events[run.id] ?? []) : [];
  const originalBrief = original ? library?.briefs.find((row) => row.id === original.brief_id) : null;
  const repair = original
    ? repairEligible({
        parent: original,
        brief: originalBrief ?? null,
        sourceTreeHash: source?.tree_hash,
        projectRevision: revision,
        runs: library?.runs ?? [],
        briefs: library?.briefs ?? [],
      })
    : { ok: false as const, code: 'not-terminal' as const, message: '' };
  const journey = journeyView.steps;
  const restoredRepairChange =
    !repairProposal && journeyView.durableBrief?.scope?.patch?.length
      ? {
          summary: journeyView.durableBrief.scope.intended_change || 'Restored repair',
          notes: 'Restored from saved proposal and approval evidence. Combined patch is shown against the original pinned source.',
          mocked: false,
          patches: journeyView.durableBrief.scope.patch,
        }
      : null;

  function applyLibrary(next: Library, incoming: RequestContext) {
    if (
      !sameConstructContext(
        { ownerId, projectId, revision, generation: generationRef.current },
        incoming,
      )
    )
      return;
    if (next.project.id !== projectId) return;
    setLibrary(next);
  }

  function currentContext(): RequestContext {
    return { ownerId, projectId, revision, generation: generationRef.current };
  }

  async function refresh(signal?: AbortSignal) {
    if (!enabled) return;
    const incoming = currentContext();
    const data = await readConstructLibrary(projectId, signal);
    if (!data.ok) throw new Error(data.error);
    applyLibrary(data.data as Library, incoming);
  }

  useEffect(() => {
    generationRef.current += 1;
    const generation = generationRef.current;
    const incoming = { ownerId, projectId, revision, generation };
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
    const incoming = currentContext();
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
  }, [enabled, ownerId, projectId, revision, run?.id, run?.status]);

  useEffect(() => {
    if (!sheet) return;
    const media = window.matchMedia('(max-width: 639px)');
    const onChange = () => {
      if (!media.matches) setSheet(null);
    };
    media.addEventListener('change', onChange);
    window.addEventListener('resize', onChange);
    return () => {
      media.removeEventListener('change', onChange);
      window.removeEventListener('resize', onChange);
    };
  }, [sheet]);

  async function proposeChange() {
    if (locked || busy) return;
    setBusy(true);
    setError('');
    const incoming = currentContext();
    const boundSnapshot = snapshot;
    try {
      const paths = files.map((file) => file.path);
      const proposed = await proposeConstructChange({
        projectId,
        instruction: intendedChange,
        intendedChange,
        allowedPaths: paths,
        protectedPaths: effectiveProtectedPaths(),
        excerpts: files,
      });
      if (!proposed.ok) throw new Error(proposed.error);
      if (!sameConstructContext({ ownerId, projectId, revision, generation: generationRef.current }, incoming))
        return;
      setProposal({
        mocked: proposed.data.mocked,
        summary: proposed.data.proposal.summary,
        notes: proposed.data.proposal.notes,
        patch: proposed.data.proposal.patch,
        snapshot: boundSnapshot,
        context: proposed.data.context ?? localContext,
        coverage: proposed.data.coverage ?? localCoverage,
      });
      setSelectedChange(proposed.data.proposal.patch[0]?.path ?? null);
      setContextPanel('change');
      if (window.matchMedia('(max-width: 639px)').matches) setSheet('change');
      setApproval(null);
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
    const incoming = currentContext();
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
      if (!sameConstructContext({ ownerId, projectId, revision, generation: generationRef.current }, incoming))
        return;
      setFiles(next);
      setGitPin({
        repository: sourceReady?.github.repository?.fullName ?? '',
        commit: sha,
        files: fileFingerprint(next),
      });
      setProposal(null);
      setApproval(null);
      setMessage('Pinned files were imported read-only. Construct cannot commit or deploy.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Pinned source unavailable.');
    } finally {
      setBusy(false);
    }
  }

  async function approveChange() {
    if (locked || busy || !liveProposal) return;
    if (liveApproval) {
      setMessage(
        'Change is already approved against these exact inputs. Enqueue retries reuse the same request.',
      );
      return;
    }
    setBusy(true);
    setError('');
    const incoming = currentContext();
    const boundSnapshot = snapshot;
    try {
      const briefId = newId();
      const sourceId = newId();
      const requestId = newId();
      const repository = sourceReady?.github.repository?.fullName ?? gitPin?.repository ?? null;
      const pinIntact = Boolean(
        sourceKind === 'git' &&
          gitPin &&
          gitPin.repository === repository &&
          gitPin.commit === commit.trim() &&
          gitPin.files === fileFingerprint(files),
      );
      const editedGitImport = Boolean(gitPin && !pinIntact);
      const approvedKind = sourceKind === 'git' && !editedGitImport ? 'git' : 'imported';
      const approved = await approveConstructChange({
        projectId,
        briefId,
        sourceId,
        expected: revision,
        sourceKind: approvedKind,
        repository: approvedKind === 'git' || editedGitImport ? repository : null,
        commit:
          approvedKind === 'git' || editedGitImport
            ? commit.trim() || gitPin?.commit || null
            : null,
        files,
        intendedChange,
        allowedPaths: files.map((file) => file.path),
        protectedPaths: effectiveProtectedPaths(),
        acceptanceChecks: acceptanceChecksFromPlan(planCheckCoverage(files)),
        checkPlan: reviewCoverage,
        patch: liveProposal.patch,
      });
      if (!approved.ok) throw new Error(approved.error);
      if (!sameConstructContext({ ownerId, projectId, revision, generation: generationRef.current }, incoming))
        return;
      const digest =
        typeof approved.data.brief?.approval_hash === 'string'
          ? approved.data.brief.approval_hash
          : '';
      if (!/^[0-9a-f]{64}$/.test(digest))
        throw new Error('Approved brief did not return a server digest.');
      setApproval({
        briefId,
        sourceId,
        approvalHash: digest,
        requestId,
        snapshot: boundSnapshot,
        revision,
      });
      setMessage(
        'Change approved against the pinned source. Enqueue retries reuse the same request until inputs change.',
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not approve the change.');
    } finally {
      setBusy(false);
    }
  }

  async function proposeRepair() {
    if (locked || busy || !original || !repair.ok) return;
    setBusy(true);
    setError('');
    const incoming = currentContext();
    try {
      const proposed = await proposeConstructRepair({
        projectId,
        parentRunId: original.id,
        instruction: intendedChange,
      });
      if (!proposed.ok) throw new Error(proposed.error);
      if (!sameConstructContext({ ownerId, projectId, revision, generation: generationRef.current }, incoming))
        return;
      setRepairProposal({
        mocked: proposed.data.mocked,
        summary: proposed.data.proposal.summary,
        notes: proposed.data.proposal.notes,
        patch: proposed.data.proposal.patch,
        combined: proposed.data.combined,
        parentRunId: proposed.data.parentRunId,
        targets: proposed.data.targets,
        snapshot,
        context: proposed.data.context ?? localContext,
        coverage: proposed.data.coverage ?? localCoverage,
      });
      setRepairApproval(null);
      setSelectedChange(proposed.data.combined[0]?.path ?? null);
      setContextPanel('change');
      if (window.matchMedia('(max-width: 639px)').matches) setSheet('change');
      setMessage(
        proposed.data.coverageNote === 'syntax-only'
          ? 'Proposed repair is syntax-only coverage. Review the combined diff before approval. No run has been queued.'
          : 'Proposed repair is ready for explicit approval. No run has been queued.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not propose a repair.');
    } finally {
      setBusy(false);
    }
  }

  async function approveRepair() {
    if (locked || busy || !repairProposal || !original) return;
    if (repairApproval) {
      setMessage('This repair is already approved. Enqueue retries reuse the same request.');
      return;
    }
    setBusy(true);
    setError('');
    const incoming = currentContext();
    try {
      const briefId = newId();
      const requestId = newId();
      const approved = await approveConstructRepair({
        projectId,
        briefId,
        parentRunId: repairProposal.parentRunId,
        expected: revision,
        patch: repairProposal.patch,
      });
      if (!approved.ok) throw new Error(approved.error);
      if (!sameConstructContext({ ownerId, projectId, revision, generation: generationRef.current }, incoming))
        return;
      const digest =
        typeof approved.data.brief?.approval_hash === 'string' ? approved.data.brief.approval_hash : '';
      if (!/^[0-9a-f]{64}$/.test(digest))
        throw new Error('Approved repair did not return a fresh server digest.');
      if (digest === original.approval_hash)
        throw new Error('Repair must use a fresh approval digest. The original approval cannot be reused.');
      setRepairApproval({
        briefId,
        sourceId: original.source_id,
        approvalHash: digest,
        requestId,
        snapshot,
        revision,
        parentRunId: original.id,
      });
      setMessage('Repair approved against the original pinned source. Enqueue retries reuse this request.');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not approve the repair.');
    } finally {
      setBusy(false);
    }
  }

  async function enqueueRepair() {
    if (locked || busy || !repairApproval) return;
    setBusy(true);
    setError('');
    const incoming = currentContext();
    try {
      const started = await startConstructRun({
        projectId,
        briefId: repairApproval.briefId,
        requestId: repairApproval.requestId,
        expected: revision,
        approvalHash: repairApproval.approvalHash,
      });
      if (!started.ok) throw new Error(started.error);
      if (!sameConstructContext({ ownerId, projectId, revision, generation: generationRef.current }, incoming))
        return;
      setMessage(
        'Approved repair queued. If it still fails, the evidence is kept and control returns here. No second repair is started automatically.',
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not enqueue the approved repair.');
    } finally {
      setBusy(false);
    }
  }

  async function enqueueApproved() {
    if (locked || busy || !liveApproval) return;
    setBusy(true);
    setError('');
    const incoming = currentContext();
    try {
      const started = await startConstructRun({
        projectId,
        briefId: liveApproval.briefId,
        requestId: liveApproval.requestId,
        expected: revision,
        approvalHash: liveApproval.approvalHash,
      });
      if (!started.ok) throw new Error(started.error);
      if (!sameConstructContext({ ownerId, projectId, revision, generation: generationRef.current }, incoming))
        return;
      setMessage(
        'Approved change queued. Retries reuse this request. The browser cannot mark checks passed.',
      );
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
      const key = `${ownerId}:${projectId}:${revision}:fixture`;
      if (!fixtureKeyRef.current || fixtureKeyRef.current.key !== key)
        fixtureKeyRef.current = { key, id: newId() };
      const started = await startConstructFixture({
        projectId,
        requestId: fixtureKeyRef.current.id,
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
      <ol className="origin-repair-journey" aria-label="Repair journey">
        <li aria-current={journey.original && !journey.observedFailure ? 'step' : undefined}>
          Original attempt{original ? ` · ${statusLabel(original.status)}` : ''}
        </li>
        <li aria-current={journey.observedFailure && !journey.proposed ? 'step' : undefined}>
          Observed failure
          {repair.ok ? ` · ${repair.targets.length} introduced` : journey.observedFailure ? ' · recorded' : ''}
        </li>
        <li aria-current={journey.proposed && !journey.approved ? 'step' : undefined}>Proposed correction</li>
        <li aria-current={journey.approved && !journey.observedResult ? 'step' : undefined}>Approved repair</li>
        <li aria-current={journey.observedResult ? 'step' : undefined}>
          Observed result
          {repairRun ? ` · ${statusLabel(repairRun.status)}` : ''}
        </li>
      </ol>
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
            onChange={(e) => {
              const next = e.target.value === 'git' ? 'git' : 'imported';
              setSourceKind(next);
              if (next !== 'git') setGitPin(null);
            }}
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
                onChange={(e) => {
                  setCommit(e.target.value);
                  if (gitPin && e.target.value.trim() !== gitPin.commit) setGitPin(null);
                }}
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
            {files.length > 1 && (
              <button
                type="button"
                disabled={!enabled || locked || busy}
                onClick={() => setFiles((current) => current.filter((_, rowIndex) => rowIndex !== index))}
              >
                Remove {file.path || 'file'}
              </button>
            )}
          </fieldset>
        ))}
        <button
          type="button"
          disabled={!enabled || locked || busy || files.length >= 32}
          onClick={() =>
            setFiles((current) => [
              ...current,
              { path: `note-${current.length + 1}.md`, content: '# Additional authorized source\n' },
            ])
          }
        >
          Add authorized source file
        </button>
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
        <button disabled={!enabled || locked || busy || !liveProposal} onClick={() => void approveChange()}>
          Approve proposed change
        </button>
        <button
          disabled={!enabled || locked || busy || !liveApproval}
          onClick={() => void enqueueApproved()}
        >
          Enqueue approved change
        </button>
        <button
          disabled={!enabled || locked || busy || !repair.ok}
          onClick={() => void proposeRepair()}
        >
          Propose repair
        </button>
        <button disabled={!enabled || locked || busy || !repairProposal} onClick={() => void approveRepair()}>
          Approve proposed repair
        </button>
        <button disabled={!enabled || locked || busy || !repairApproval} onClick={() => void enqueueRepair()}>
          Enqueue approved repair
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
      {proposal && !liveProposal && (
        <p>
          The proposed change no longer matches the current source, intended change, or project
          revision. Propose again before approval.
        </p>
      )}
      {approval && !liveApproval && (
        <p>
          The previous approval is invalid. Changing the source kind, repository, commit, files,
          intended change, or project revision requires a new proposal and approval.
        </p>
      )}
      {liveApproval && (
        <p>
          Approved inputs are bound to server digest {liveApproval.approvalHash.slice(0, 12)}. Enqueue
          retries reuse the same request until a new approval is created.
        </p>
      )}
      <div className="origin-construct-review">
        <aside className="origin-construct-context" ref={panelScrollRef} aria-label="Review context">
          <nav className="origin-construct-views" aria-label="Review context">
            {(
              [
                ['understand', 'Source'],
                ['change', 'Change'],
                ['evidence', 'Evidence'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-current={contextPanel === id ? 'page' : undefined}
                data-bplus-surface={contextPanel === id ? 'selection' : undefined}
                onClick={() => {
                  if (panelScrollRef.current)
                    panelScrollByView.current[contextPanel] = panelScrollRef.current.scrollTop;
                  setContextPanel(id);
                  requestAnimationFrame(() => {
                    if (panelScrollRef.current)
                      panelScrollRef.current.scrollTop = panelScrollByView.current[id] ?? 0;
                  });
                  if (window.matchMedia('(max-width: 639px)').matches) setSheet(id);
                }}
              >
                {contextPanel === id && <BplusMaterial radius={8} />}
                {label}
              </button>
            ))}
          </nav>
          <div className="origin-construct-context-body" hidden={Boolean(sheet)}>
            {contextPanel === 'understand' && (
              <SourceUnderstanding
                context={reviewContext}
                selectedPath={selectedSource}
                onSelect={(path) => {
                  setSelectedSource(path);
                  const match = files.find((file) => file.path === path);
                  if (match)
                    document
                      .querySelector(`input[value="${CSS.escape(match.path)}"]`)
                      ?.scrollIntoView({ block: 'nearest' });
                }}
              />
            )}
            {contextPanel === 'change' && repairProposal && (
              <ChangeDiff
                summary={repairProposal.summary}
                notes={`${repairProposal.notes} Combined patch is shown against the original pinned source.`}
                mocked={repairProposal.mocked}
                patches={repairProposal.combined.map((file) => ({
                  ...file,
                  intent: repairProposal.summary,
                }))}
                selectedPath={selectedChange}
                onSelect={setSelectedChange}
              />
            )}
            {contextPanel === 'change' && !repairProposal && restoredRepairChange && (
              <ChangeDiff
                summary={restoredRepairChange.summary}
                notes={restoredRepairChange.notes}
                mocked={restoredRepairChange.mocked}
                patches={restoredRepairChange.patches.map((file) => ({
                  ...file,
                  intent: restoredRepairChange.summary,
                }))}
                selectedPath={selectedChange}
                onSelect={setSelectedChange}
              />
            )}
            {contextPanel === 'change' && liveProposal && !repairProposal && !restoredRepairChange && (
              <ChangeDiff
                summary={liveProposal.summary}
                notes={liveProposal.notes}
                mocked={liveProposal.mocked}
                patches={liveProposal.patch.map((file) => ({
                  ...file,
                  intent: liveProposal.summary,
                  warning:
                    file.after === '' && file.before !== ''
                      ? 'Empty replacement content is not deletion; the file remains.'
                      : undefined,
                }))}
                selectedPath={selectedChange}
                onSelect={setSelectedChange}
              />
            )}
            {contextPanel === 'change' && !liveProposal && !repairProposal && !restoredRepairChange && (
              <article className="origin-construct-pane">
                <h4>Proposed change awaiting approval</h4>
                <p>Propose a change against complete authorized files to inspect a before/after diff.</p>
              </article>
            )}
            {contextPanel === 'evidence' && (
              <CheckEvidence
                plan={reviewCoverage}
                coverage={resultRun?.result?.coverage}
                checks={resultRun?.result?.checks ?? []}
                baseline={resultRun?.result?.baseline_checks}
                selectedName={selectedCheck}
                onSelect={setSelectedCheck}
              />
            )}
          </div>
        </aside>
        <section className="origin-construct-canvas" aria-label="Last valid preview">
          <h4>Isolated preview</h4>
          <p>{retained.label}</p>
          {run && retained.stale && (
            <p>
              Current attempt {statusLabel(run.status)}
              {run.project_revision != null ? ` · revision ${run.project_revision}` : ''}. This
              preview is not that attempt.
            </p>
          )}
          {retained.body ? (
            <iframe
              title="Construct preview"
              sandbox=""
              srcDoc={retained.body}
              className="origin-construct-preview"
            />
          ) : (
            <p>
              {run?.result?.preview.unavailable_reason ||
                run?.result?.blocker ||
                retained.label}
            </p>
          )}
          {retained.run?.result && (
            <p>
              Isolation {retained.run.result.isolation}. Runtime available{' '}
              {retained.run.result.runtime_available ? 'yes' : 'no'}. Sandbox executed{' '}
              {retained.run.result.sandbox ? 'yes' : 'no'}. Artifact {retained.artifactId}. A Docker
              probe is not a sandbox.
            </p>
          )}
        </section>
      </div>
      <ContextSheet open={Boolean(sheet)} title="review" onClose={() => setSheet(null)}>
        <div className="origin-construct-sheet-card">
          {sheet === 'understand' && (
            <SourceUnderstanding
              context={reviewContext}
              selectedPath={selectedSource}
              onSelect={setSelectedSource}
            />
          )}
          {sheet === 'change' && repairProposal && (
            <ChangeDiff
              summary={repairProposal.summary}
              notes={`${repairProposal.notes} Combined patch is shown against the original pinned source.`}
              mocked={repairProposal.mocked}
              patches={repairProposal.combined}
              selectedPath={selectedChange}
              onSelect={setSelectedChange}
            />
          )}
          {sheet === 'change' && !repairProposal && restoredRepairChange && (
            <ChangeDiff
              summary={restoredRepairChange.summary}
              notes={restoredRepairChange.notes}
              mocked={restoredRepairChange.mocked}
              patches={restoredRepairChange.patches}
              selectedPath={selectedChange}
              onSelect={setSelectedChange}
            />
          )}
          {sheet === 'change' && liveProposal && !repairProposal && !restoredRepairChange && (
            <ChangeDiff
              summary={liveProposal.summary}
              notes={liveProposal.notes}
              mocked={liveProposal.mocked}
              patches={liveProposal.patch}
              selectedPath={selectedChange}
              onSelect={setSelectedChange}
            />
          )}
          {sheet === 'evidence' && (
            <CheckEvidence
              plan={reviewCoverage}
              coverage={resultRun?.result?.coverage}
              checks={resultRun?.result?.checks ?? []}
              baseline={resultRun?.result?.baseline_checks}
              selectedName={selectedCheck}
              onSelect={setSelectedCheck}
            />
          )}
        </div>
      </ContextSheet>
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
              <p>Allowed paths: {(brief.scope.allowed_paths ?? []).join(', ') || 'none recorded'}.</p>
              <p>Protected paths: {(brief.scope.protected_paths ?? []).join(', ') || 'none recorded'}.</p>
              <p>
                Limits:{' '}
                {brief.scope.resource_limits
                  ? `${brief.scope.resource_limits.timeout_ms}ms timeout, ${brief.scope.resource_limits.max_files} files.`
                  : 'not recorded on this receipt.'}
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
          {original && (
            <p>
              Original attempt {statusLabel(original.status)}
              {original.project_revision != null ? ` · revision ${original.project_revision}` : ''}.
            </p>
          )}
          {repairRun && (
            <p>
              Repair result {statusLabel(repairRun.status)}
              {repairRun.result?.blocker ? ` — ${repairRun.result.blocker}` : ''}.
            </p>
          )}
          {library?.proposal?.mode === 'mock' && (
            <p>Labelled mocked provider is available. This is not a paid OpenAI call.</p>
          )}
          {library?.proposal?.mode === 'disabled' && library.proposal.reason && (
            <p>{library.proposal.reason}</p>
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
          {resultRun?.result?.changed_files.length ? (
            <>
              <p>{resultRun.result.changed_files.join(', ')}</p>
              <pre>{resultRun.result.diff || 'No textual diff was collected.'}</pre>
            </>
          ) : (
            <p>
              {resultRun?.result?.blocker ||
                'No execution result yet. Queued runs do not display a simulated diff.'}
            </p>
          )}
        </article>
      )}
      {view === 'Checks' && (
        <article className="origin-construct-pane">
          <h4>Actual commands</h4>
          <CheckEvidence
            plan={brief?.scope.check_plan ?? reviewCoverage}
            coverage={resultRun?.result?.coverage}
            checks={resultRun?.result?.checks ?? []}
            baseline={resultRun?.result?.baseline_checks}
            selectedName={selectedCheck}
            onSelect={setSelectedCheck}
          />
        </article>
      )}
      {view === 'Preview' && (
        <article className="origin-construct-pane">
          <h4>Isolated preview</h4>
          <p>{retained.label}</p>
          {run && retained.stale && (
            <p>
              Current attempt {statusLabel(run.status)}
              {run.project_revision != null ? ` · revision ${run.project_revision}` : ''}. This
              preview is not that attempt.
            </p>
          )}
          {retained.body ? (
            <iframe
              title="Construct preview"
              sandbox=""
              srcDoc={retained.body}
              className="origin-construct-preview"
            />
          ) : (
            <p>
              {run?.result?.preview.unavailable_reason ||
                run?.result?.blocker ||
                'Preview is unavailable until isolated output is collected.'}
            </p>
          )}
          {retained.run?.result && (
            <p>
              Isolation {retained.run.result.isolation}. Runtime available{' '}
              {retained.run.result.runtime_available ? 'yes' : 'no'}. Sandbox executed{' '}
              {retained.run.result.sandbox ? 'yes' : 'no'}. A Docker probe is not a sandbox.
            </p>
          )}
        </article>
      )}
    </div>
  );
}
