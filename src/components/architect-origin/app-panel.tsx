'use client';

import { BplusMaterial } from '@/components/visual/bplus-material';
import { useEffect, useMemo, useRef, useState } from 'react';
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

const panels = ['Files', 'Changes', 'Records', 'Revisions'] as const;

export function ArchitectAppPanel({
  ownerId,
  projectId,
  revision,
  enabled,
  locked,
}: {
  ownerId: string;
  projectId: string;
  revision: number;
  enabled: boolean;
  locked: boolean;
}) {
  const [library, setLibrary] = useState<AppLibrary | null>(null);
  const [proposal, setProposal] = useState<Record<string, unknown> | null>(null);
  const [viewport, setViewport] = useState<'desktop' | 'phone'>('desktop');
  const [panel, setPanel] = useState<(typeof panels)[number]>('Files');
  const [refineOpen, setRefineOpen] = useState(false);
  const [draft, setDraft] = useState('Create a project tracker I can use and save records in.');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const frame = useRef<HTMLIFrameElement>(null);
  const scroll = useRef(0);
  const plane = useRef<HTMLDivElement>(null);

  const recovered = library?.pendingStart ?? null;
  const current = library?.current ?? null;
  const working = library?.working ?? null;
  const latestJob = library?.jobs[0] ?? null;

  async function refresh() {
    const next = await readArchitectApps(projectId);
    setLibrary(next);
    return next;
  }

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void fetch(`/api/architect-apps?project=${projectId}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json()) as AppLibrary & { error?: string };
        if (!response.ok) throw new Error(data.error || 'Application library unavailable.');
        setLibrary(data);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : 'Application library unavailable.');
      });
    return () => controller.abort();
  }, [enabled, ownerId, projectId]);

  useEffect(() => {
    const node = plane.current;
    if (node) node.scrollTop = scroll.current;
    return () => {
      if (node) scroll.current = node.scrollTop;
    };
  }, [panel, viewport]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data as { schema?: string; session?: string; requestId?: string };
      if (!data || data.schema !== 'architect-apps-data/v1' || event.source !== frame.current?.contentWindow) return;
      const revisionId = current?.status === 'ready' ? current.id : working?.id;
      if (!revisionId || !data.session) return;
      void forwardAppData(data as never, projectId, revisionId)
        .then((result) => {
          frame.current?.contentWindow?.postMessage({ schema: 'architect-apps-data/v1', ...result }, '*');
        })
        .catch((reason: unknown) => {
          frame.current?.contentWindow?.postMessage(
            {
              schema: 'architect-apps-data/v1',
              requestId: data.requestId,
              ok: false,
              error: reason instanceof Error ? reason.message : 'Host collection refused the request.',
            },
            '*',
          );
        });
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [current, working, projectId]);

  const files = useMemo(
    () => library?.revisions.find((row) => row.id === current?.id)?.files.filter((file) => file.path.startsWith('src/')) ?? [],
    [library, current],
  );
  const changes = ((proposal?.changes as { path: string; kind: string }[]) ?? []).filter((row) => row.kind !== 'unchanged');

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
        baseRevision: library?.app?.current_revision,
        demo: 'tracker',
      });
      setProposal(next);
      setPanel('Changes');
      setMessage('Reviewed files are shown before approval. Accepting a revision is not publishing.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Proposal unavailable.');
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
      setError(reason instanceof Error ? reason.message : 'Approval was not confirmed.');
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
      setMessage('Trusted build queued. An unsent refine draft is kept.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Build was not queued.');
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
    <section className="architect-app" aria-label="Generated application workbench">
      <div className="architect-app-stage">
        <header className="architect-app-toolbar">
          <div>
            <p className="architect-app-kicker">Working application</p>
            <h3>
              {current ? `Revision ${current.revision}` : 'No application yet'}
              {working && working.revision !== current?.revision ? ` · last working ${working.revision}` : ''}
            </h3>
            <p>
              {latestJob
                ? `Build ${latestJob.status}${latestJob.result?.blocker ? ` — ${latestJob.result.blocker}` : ''}`
                : recovered
                  ? `Approved revision ${recovered.revision} recovered. Start remains explicit.`
                  : library?.provider.reason || 'Describe a useful app, then review files before approval.'}
            </p>
          </div>
          <div className="architect-app-viewports">
            <button type="button" aria-pressed={viewport === 'desktop'} onClick={() => setViewport('desktop')}>
              Desktop
            </button>
            <button type="button" aria-pressed={viewport === 'phone'} onClick={() => setViewport('phone')}>
              Phone
            </button>
          </div>
        </header>
        <div className={`architect-app-frame architect-app-frame-${viewport}`} ref={plane}>
          {library?.preview ? (
            <iframe
              ref={frame}
              title="Private generated application preview"
              sandbox={library.preview.sandbox}
              srcDoc={library.preview.srcDoc}
            />
          ) : (
            <div className="architect-app-empty">
              <p>The compiled application will occupy this canvas after an explicit approved build.</p>
              <p>{library?.preview ? '' : 'Static document preview remains script-disabled on other surfaces.'}</p>
            </div>
          )}
        </div>
        <p className="architect-app-checks">
          Typecheck {latestJob?.result?.typecheck.ok ? 'passed' : latestJob ? 'pending or failed' : 'not run'} · Bundle{' '}
          {latestJob?.result?.bundle.ok ? 'passed' : latestJob ? 'pending or failed' : 'not run'} · Profile{' '}
          {library?.profile.toolchain}
        </p>
      </div>
      <aside className="architect-app-side" aria-label="Application details">
        <div className="architect-app-tabs">
          {panels.map((tab) => (
            <button key={tab} type="button" aria-current={panel === tab ? 'page' : undefined} onClick={() => setPanel(tab)}>
              {tab}
            </button>
          ))}
        </div>
        {panel === 'Files' && (
          <ol>
            {files.map((file) => (
              <li key={file.path}>
                <code>{file.path}</code>
              </li>
            ))}
            {!files.length && <li>No generated files yet.</li>}
          </ol>
        )}
        {panel === 'Changes' && (
          <ol>
            {changes.map((change) => (
              <li key={change.path}>
                {change.kind} <code>{change.path}</code>
              </li>
            ))}
            {!changes.length && <li>No pending revision. Request a change to preview the file operations.</li>}
          </ol>
        )}
        {panel === 'Records' && (
          <ol>
            {Object.entries(library?.records ?? {}).flatMap(([collection, rows]) =>
              rows.map((row) => (
                <li key={`${collection}:${String(row.id)}`}>
                  {collection}: {String(row.title ?? row.id)}
                </li>
              )),
            )}
            {!Object.values(library?.records ?? {}).flat().length && <li>Records belong to the app and survive preview sessions.</li>}
          </ol>
        )}
        {panel === 'Revisions' && (
          <ol>
            {library?.revisions.map((row) => (
              <li key={row.id}>
                Revision {row.revision} · {row.status}
                {row.working ? ' · last working' : ''}
                {row.working ? (
                  <button type="button" disabled={busy || locked} onClick={() => void reopenArchitectApp(projectId, row.revision).then(refresh)}>
                    Reopen
                  </button>
                ) : null}
              </li>
            ))}
          </ol>
        )}
        <div className="architect-app-actions">
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
            <button disabled={busy} onClick={() => void cancelArchitectApp(projectId, latestJob.id).then(refresh)}>
              Cancel build
            </button>
          ) : null}
          <button disabled={busy} onClick={() => void refresh()}>
            Reload receipts
          </button>
        </div>
      </aside>
      <aside className={`architect-app-refine${refineOpen ? ' is-open' : ''}`}>
        <button type="button" className="architect-app-refine-toggle" onClick={() => setRefineOpen(!refineOpen)}>
          Refine
        </button>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void propose();
          }}
        >
          <label>
            Request
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.currentTarget.value)}
              maxLength={2000}
              disabled={busy || locked || latestJob?.status === 'running'}
            />
          </label>
          <p>Unsent refine text is kept while a build runs. A later request does not mutate an already approved execution.</p>
          <button className="button" disabled={busy || locked || !draft.trim()}>
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
