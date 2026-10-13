'use client';
import { BplusMaterial } from '@/components/visual/bplus-material';
import '@/components/visual/bplus-operator.css';
import './studio.css';
import { compileDocument } from '@/domains/architect-origin/documents';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { ArchitectConstructPanel } from './construct-panel';
import { ArtifactCanvas } from './artifact-canvas';
import { CreationEntry, type BriefStage } from './creation-entry';
import { ReadinessNotice } from './readiness-notice';
import {
  FoldDock,
  OutlineRail,
  RevisionStrip,
  WorkbenchHeader,
  type FoldPanel,
  type WorkbenchView,
} from './workbench-shell';
import { readConstructPreview } from './construct-preview-adapter';
import {
  bindPreviewIdentity,
  retainHeldPreview,
  samePreviewOwnerProject,
  type PreviewDecision,
} from '@/domains/architect-origin/preview-contract';
import {
  documentPreviewMode,
  LABELLED_DEMONSTRATION_HTML,
} from '@/domains/architect-origin/static-preview';
import { useOriginDraft, type OriginDraft } from './draft-handoff';
import {
  sections,
  documentKinds,
  initialProject,
  projectContentSchema,
  safeUrl,
  projectMarkdown,
  consistencyNotes,
  generateCommand,
  type ProjectContent,
  type OriginProject,
  type OriginVersion,
  type OriginRun,
  type saveCommand,
} from '@/domains/architect-origin/schema';
import type { z } from 'zod';
const markdownComponents = { img: () => <span>[External image omitted]</span> };
type Library = { projects: OriginProject[]; versions: OriginVersion[]; runs: OriginRun[] };
const surfaces = ['Conversation', 'Blueprint', 'Research', 'Deliverables', 'Construct', 'History'] as const;
type Surface = (typeof surfaces)[number];
type DocumentView = 'Edit' | 'Preview' | 'Split';
type PendingReference = { url: string; title: string; provenance: 'user' };
class OriginRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
async function request<T>(url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const deadline = AbortSignal.timeout(body ? 60000 : 15000);
  const response = await fetch(url, {
    cache: 'no-store',
    signal: signal ? AbortSignal.any([signal, deadline]) : deadline,
    ...(body
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const data = await response.json();
  if (!response.ok)
    throw new OriginRequestError(data.error || 'Request unavailable.', response.status);
  return data;
}
function projectLocation(id: string | null) {
  const url = new URL(location.href);
  if (id) url.searchParams.set('project', id);
  else url.searchParams.delete('project');
  for (const key of ['surface', 'section', 'document', 'view']) url.searchParams.delete(key);
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
}
function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name.replace(/[^a-z0-9_-]/gi, '-').slice(0, 80) + '.md';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function ArchitectOrigin({
  enabled = false,
  aiEnabled = false,
  constructEnabled = false,
}: {
  enabled?: boolean;
  aiEnabled?: boolean;
  constructEnabled?: boolean;
}) {
  const [library, setLibrary] = useState<Library>({ projects: [], versions: [], runs: [] });
  const [selected, setSelected] = useState<OriginProject | null>(null);
  const [draft, setDraft] = useState<ProjectContent | null>(null);
  const [surface, setSurface] = useState<Surface>('Conversation');
  const [documentView, setDocumentView] = useState<DocumentView>('Split');
  const [focusCanvas, setFocusCanvas] = useState(false);
  const [discipline, setDiscipline] = useState<ProjectContent['discipline']>('business');
  const [idea, setIdea] = useState('');
  const [name, setName] = useState('');
  const [instruction, setInstruction] = useState('');
  const [key, setKey] = useState<keyof typeof sections>('vision');
  const [kind, setKind] = useState<(typeof documentKinds)[number]>('Business plan');
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceTitle, setSourceTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState<z.infer<typeof saveCommand> | null>(null);
  const [uncertainRun, setUncertainRun] = useState(false);
  const [history, setHistory] = useState<OriginVersion | null>(null);
  const [loaded, setLoaded] = useState(!enabled);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [audience, setAudience] = useState('');
  const [constraints, setConstraints] = useState('');
  const [outcome, setOutcome] = useState('');
  const [briefStage, setBriefStage] = useState<BriefStage>('idea');
  const [studioTab, setStudioTab] = useState<'origin' | 'projects'>('origin');
  const [workbenchView, setWorkbenchView] = useState<WorkbenchView>('preview');
  const [foldPanel, setFoldPanel] = useState<FoldPanel>('canvas');
  const [compareId, setCompareId] = useState<string | null>(null);
  const [pendingReferences, setPendingReferences] = useState<PendingReference[]>([]);
  const [addingReference, setAddingReference] = useState(false);
  const [constructDecision, setConstructDecision] = useState<PreviewDecision | null>(null);
  const [heldPreview, setHeldPreview] = useState<PreviewDecision | null>(null);
  const constructRequest = useRef<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const projectTitle = useRef<HTMLHeadingElement | null>(null);
  const planeRef = useRef<HTMLElement | null>(null);
  const planeScroll = useRef<Record<string, number>>({});
  const dirty = !!draft && !!selected && JSON.stringify(draft) !== JSON.stringify(selected.content);
  const locked = busy || !!pending;
  const activeDoc = draft?.documents.find((d) => d.id === documentId);
  const handoff = useOriginDraft();
  const recovery = useRef<OriginDraft | null>(null);
  const readCompleted = useRef(false);
  useEffect(() => {
    const owner =
      selected?.person_id || library.projects.find((p) => p.id === selected?.id)?.person_id;
    recovery.current =
      selected && draft && owner && (dirty || pending || busy || uncertainRun)
        ? {
            base: { ...selected, person_id: owner },
            content: draft,
            pending,
            uncertainRun: uncertainRun || (busy && !pending),
          }
        : null;
  }, [selected, draft, library.projects, dirty, pending, busy, uncertainRun]);
  useEffect(
    () => () => {
      if (readCompleted.current) handoff?.stage(recovery.current);
    },
    [handoff],
  );
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const projectId = new URLSearchParams(location.search).get('project');
    request<Library>(
      '/api/architect-origin' + (projectId ? `?project=${encodeURIComponent(projectId)}` : ''),
      undefined,
      controller.signal,
    )
      .then((data) => {
        if (controller.signal.aborted) return;
        readCompleted.current = true;
        setLibrary(data);
        const project = data.projects.find((p) => p.id === projectId);
        const retained = handoff?.take(project);
        const restored =
          retained?.pending && data.versions.some((v) => v.id === retained.pending?.requestId)
            ? null
            : retained;
        if (project) {
          const content = restored?.content ?? project.content;
          const params = new URLSearchParams(location.search);
          const savedSurface = params.get('surface');
          if (surfaces.some((s) => s === savedSurface)) setSurface(savedSurface as Surface);
          const section = params.get('section');
          if (section && Object.hasOwn(sections, section)) setKey(section as keyof typeof sections);
          const savedDocument = params.get('document');
          if (content.documents.some((d) => d.id === savedDocument)) setDocumentId(savedDocument);
          const view = params.get('view');
          if (view === 'Edit' || view === 'Preview' || view === 'Split') setDocumentView(view);
          const studio = params.get('studio');
          if (
            studio === 'plan' ||
            studio === 'changes' ||
            studio === 'checks' ||
            studio === 'preview'
          )
            setWorkbenchView(studio);
          setSelected(restored?.base ?? project);
          setDraft(structuredClone(content));
          setPending(restored?.pending ?? null);
          setUncertainRun(restored?.uncertainRun ?? false);
          setMessage(
            restored
              ? `Unsaved work restored from this workspace. Based on revision ${restored.base.revision}; current saved revision ${project.revision}. Review before saving${restored.pending || restored.uncertainRun ? ' and inspect receipts for unconfirmed requests' : ''}.`
              : `Resumed revision ${project.revision}. Exploration is separate from approved direction.`,
          );
        }
        setLoaded(true);
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          if (e instanceof OriginRequestError && [401, 403, 404].includes(e.status)) {
            handoff?.take(undefined);
            readCompleted.current = true;
          }
          setError(e.message);
          setLoaded(true);
        }
      });
    return () => controller.abort();
  }, [enabled, handoff, loadAttempt]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty || pending || busy) event.preventDefault();
    };
    const guard = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const link = target?.closest('a');
      // The shared phone shortcut routes imperatively; protect it like a navigation link.
      const shortcutExit =
        !!target?.closest('button.aurelius-trigger') && matchMedia('(max-width: 1100px)').matches;
      if (
        !(dirty || pending || busy) ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        (!link && !shortcutExit) ||
        link?.target === '_blank' ||
        link?.download
      )
        return;
      const destination = new URL(link?.href ?? '/app/aethelios', location.href);
      if (destination.origin === location.origin && destination.pathname !== location.pathname) {
        if (
          !window.confirm(
            'Leave Architect with unsaved or unconfirmed work? Export the draft first if you need to keep it.',
          )
        ) {
          event.preventDefault();
          event.stopPropagation();
        } else {
          // Explicit leave discards; unprompted history navigation retains the draft.
          recovery.current = null;
          handoff?.stage(null);
        }
      }
    };
    document.addEventListener('click', guard, true);
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
      document.removeEventListener('click', guard, true);
    };
  }, [dirty, pending, busy, handoff]);
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    if (!loaded || !selected || location.pathname !== '/app/architect') return;
    const url = new URL(location.href);
    // A native Back can change location before this passive effect is flushed.
    // Only the currently selected Architect entry owns these view parameters.
    if (url.searchParams.get('project') !== selected.id) return;
    url.searchParams.set('surface', surface);
    url.searchParams.set('section', key);
    if (documentId) url.searchParams.set('document', documentId);
    else url.searchParams.delete('document');
    url.searchParams.set('view', documentView);
    url.searchParams.set('studio', workbenchView);
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  }, [loaded, selected, surface, key, documentId, documentView, workbenchView]);
  useEffect(() => {
    // Selection-only GET. No start/poll/cancel; building remains false until PR #116 lifecycle is wired.
    if (!selected || !constructEnabled) {
      constructRequest.current = null;
      return;
    }
    const projectId = selected.id;
    const ownerId = selected.person_id;
    const revision = selected.revision;
    const requestKey = `${projectId}:${ownerId}:${revision}`;
    constructRequest.current = requestKey;
    const controller = new AbortController();
    void readConstructPreview({
      projectId,
      ownerId,
      revision,
      signal: controller.signal,
    }).then((status) => {
      if (controller.signal.aborted || constructRequest.current !== requestKey) return;
      if (status.state === 'ready' && status.decision.kind !== 'unavailable') {
        if (!samePreviewOwnerProject(status.decision, projectId, ownerId)) return;
        setConstructDecision(status.decision);
        setHeldPreview(status.decision);
      } else if (status.state === 'ready') {
        setConstructDecision({
          kind: 'unavailable',
          reason:
            status.decision.kind === 'unavailable'
              ? status.decision.reason
              : 'Construct preview unavailable.',
          identity: bindPreviewIdentity({ projectId, ownerId, revision, persisted: true }),
        });
      } else if (status.state === 'unavailable') {
        setConstructDecision({
          kind: 'unavailable',
          reason: status.reason,
          identity: bindPreviewIdentity({
            projectId,
            ownerId,
            revision,
            persisted: true,
          }),
        });
      }
    });
    return () => {
      if (constructRequest.current === requestKey) constructRequest.current = null;
      controller.abort();
    };
  }, [selected, constructEnabled]);
  useEffect(() => {
    const node = planeRef.current;
    const positions = planeScroll.current;
    if (!node) return;
    const token = `${surface}:${workbenchView}`;
    const stored = positions[token];
    if (typeof stored === 'number') node.scrollTop = stored;
    return () => {
      positions[token] = node.scrollTop;
    };
  }, [surface, workbenchView]);
  function shapedContent() {
    const content = initialProject(idea, discipline);
    if (name.trim()) content.name = name.trim();
    if (audience.trim()) content.blueprint.audience = audience.trim();
    if (constraints.trim()) content.blueprint.requirements = constraints.trim();
    if (outcome.trim()) content.blueprint.next = outcome.trim();
    if (pendingReferences.length) content.sources = pendingReferences;
    return content;
  }
  function labelledDemonstration() {
    return new URLSearchParams(location.search).get('demo') === 'architect-preview';
  }
  function originArtifactDecision(): PreviewDecision | null {
    if (!selected || !draft) return null;
    const scopedConstruct = samePreviewOwnerProject(
      constructDecision,
      selected.id,
      selected.person_id,
    )
      ? constructDecision
      : null;
    const scopedHeld = retainHeldPreview(heldPreview, selected.id, selected.person_id);
    if (labelledDemonstration()) {
      const identity = bindPreviewIdentity({
        projectId: selected.id,
        ownerId: selected.person_id,
        revision: selected.revision,
        persisted: false,
      });
      if (!identity) return { kind: 'unavailable', reason: 'Preview identity is incomplete.', identity: null };
      return {
        kind: 'static-html',
        identity,
        srcDoc: LABELLED_DEMONSTRATION_HTML,
        markdown: null,
        path: null,
        labelledDemonstration: true,
        provenance: 'demonstration',
      };
    }
    if (scopedConstruct && scopedConstruct.kind !== 'unavailable') return scopedConstruct;
    if (scopedHeld) return scopedHeld;
    const doc = draft.documents.find((item) => item.id === documentId) ?? draft.documents[0];
    if (!doc) {
      const identity = bindPreviewIdentity({
        projectId: selected.id,
        ownerId: selected.person_id,
        revision: selected.revision,
        persisted: true,
      });
      return {
        kind: 'unavailable',
        reason:
          'No generated website artifact is attached to this revision. The brief and Origin documents remain the current work.',
        identity,
      };
    }
    const saved = selected.content.documents.find((item) => item.id === doc.id);
    const persisted = !!saved && saved.content === doc.content;
    const identity = bindPreviewIdentity({
      projectId: selected.id,
      ownerId: selected.person_id,
      revision: selected.revision,
      artifactId: doc.id,
      persisted,
    });
    if (!identity) return { kind: 'unavailable', reason: 'Preview identity is incomplete.', identity: null };
    const provenance = persisted ? 'saved-document' : 'unsaved-draft';
    if (documentPreviewMode(doc.content) === 'html') {
      return {
        kind: 'static-html',
        identity,
        srcDoc: doc.content,
        markdown: null,
        path: null,
        labelledDemonstration: false,
        provenance,
      };
    }
    return {
      kind: 'markdown-document',
      identity,
      srcDoc: null,
      markdown: doc.content,
      path: null,
      labelledDemonstration: false,
      provenance,
    };
  }
  function openWorkbenchView(next: WorkbenchView) {
    setWorkbenchView(next);
    setFoldPanel('canvas');
    if (next === 'plan') setSurface('Blueprint');
    if (next === 'changes') setSurface('Conversation');
    if (next === 'preview') setSurface('Conversation');
    setHistory(null);
  }
  function change(content: ProjectContent) {
    setDraft(content);
    setMessage('Unsaved draft. Approved project is unchanged.');
  }
  async function open(project: OriginProject) {
    if (locked || (dirty && !window.confirm('Discard unsaved draft and open this project?')))
      return;
    setBusy(true);
    setError('');
    try {
      const data = await request<Library>(`/api/architect-origin?project=${project.id}`);
      const fresh = data.projects.find((p) => p.id === project.id)!;
      setLibrary(data);
      setSelected(fresh);
      setDraft(structuredClone(fresh.content));
      setDocumentId(null);
      setHistory(null);
      setCompareId(null);
      setConstructDecision(null);
      setHeldPreview(retainHeldPreview(heldPreview, fresh.id, fresh.person_id));
      setSurface('Conversation');
      setWorkbenchView('preview');
      setUncertainRun(false);
      requestAnimationFrame(() => projectTitle.current?.focus());
      projectLocation(project.id);
      setMessage(
        `Resumed revision ${fresh.revision}. Exploration is separate from approved direction.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Project unavailable.');
    } finally {
      setBusy(false);
    }
  }
  async function refreshReceipts() {
    if (!selected && handoff?.hasDraft()) {
      setError('');
      setLoaded(false);
      setLoadAttempt((attempt) => attempt + 1);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const id = selected?.id ?? pending?.projectId;
      const data = await request<Library>('/api/architect-origin' + (id ? `?project=${id}` : ''));
      setLibrary(data);
      if (pending) {
        const receipt = data.versions.find((v) => v.id === pending.requestId);
        if (receipt) {
          const project = data.projects.find((p) => p.id === pending.projectId)!;
          projectLocation(project.id);
          setSelected(project);
          setDraft(structuredClone(project.content));
          setPending(null);
          setIdea('');
          setName('');
          setMessage('Saved revision confirmed from its receipt.');
        } else
          setMessage(
            'No matching save receipt found. Retry only the same save, or recover the draft after checking the current revision.',
          );
      } else if (selected && !dirty) {
        const project = data.projects.find((p) => p.id === selected.id)!;
        setSelected(project);
        setDraft(structuredClone(project.content));
      }
      setUncertainRun(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Receipts unavailable.');
    } finally {
      setBusy(false);
    }
  }
  async function loadOlderHistory() {
    if (!selected || busy || !library.versions.length) return;
    setBusy(true);
    setError('');
    try {
      const before = library.versions[library.versions.length - 1]!.revision;
      const data = await request<Library>(
        `/api/architect-origin?project=${selected.id}&before=${before}`,
      );
      setLibrary((old) => ({
        ...old,
        versions: [
          ...old.versions,
          ...data.versions.filter((v) => !old.versions.some((current) => current.id === v.id)),
        ],
      }));
      setMessage(data.versions.length ? 'Earlier revisions loaded.' : 'No earlier revisions.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'History unavailable.');
    } finally {
      setBusy(false);
    }
  }
  async function save(command?: z.infer<typeof saveCommand>) {
    const input =
      command ??
      pending ??
      (selected && draft
        ? {
            action: 'save' as const,
            projectId: selected.id,
            requestId: crypto.randomUUID(),
            expected: selected.revision,
            content: draft,
            note: `User saved ${surface.toLowerCase()} changes`,
          }
        : null);
    if (!input || !projectContentSchema.safeParse(input.content).success) {
      setError('Check content limits, title and fields. Export your draft before shortening it.');
      return;
    }
    setPending(input);
    setBusy(true);
    setError('');
    setMessage('Saving exact draft…');
    try {
      const result = await request<{ revision: number; requestId: string; personId: string }>(
        '/api/architect-origin',
        input,
      );
      if (typeof result.personId !== 'string' || !result.personId.trim()) {
        throw new Error('Save ownership was not confirmed. Reload receipts before editing.');
      }
      const project: OriginProject = {
        id: input.projectId,
        person_id: result.personId,
        revision: result.revision,
        content: structuredClone(input.content),
        created_at: selected?.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setSelected(project);
      if (!selected) requestAnimationFrame(() => projectTitle.current?.focus());
      setDraft(structuredClone(input.content));
      setPending(null);
      setIdea('');
      setName('');
      setLibrary((old) => ({
        ...old,
        projects: [project, ...old.projects.filter((p) => p.id !== project.id)],
        ...(selected?.id !== project.id ? { versions: [], runs: [] } : {}),
      }));
      projectLocation(project.id);
      setMessage(`Saved revision ${result.revision}. Confirmed by the server.`);
      try {
        const data = await request<Library>(`/api/architect-origin?project=${project.id}`);
        setLibrary(data);
      } catch {
        setMessage(
          `Revision ${result.revision} saved. History refresh unavailable; reload receipts later.`,
        );
      }
    } catch (e) {
      setError(
        (e instanceof Error ? e.message : 'Save unconfirmed.') +
          ' The exact draft is retained and editing is paused.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function generate(task: OriginRun['kind']) {
    if (!selected || dirty || uncertainRun || busy || !instruction.trim()) return;
    const controller = new AbortController();
    abort.current = controller;
    const input = {
      action: 'generate' as const,
      projectId: selected.id,
      requestId: crypto.randomUUID(),
      expected: selected.revision,
      kind: task,
      instruction,
      documentKind: kind,
      documentId: task === 'document' ? documentId : null,
      consent: true as const,
    };
    setBusy(true);
    setError('');
    setMessage('Aethelios is preparing a proposal. Approved content will remain unchanged.');
    try {
      const { run } = await request<{ run: OriginRun }>(
        '/api/architect-origin',
        input,
        controller.signal,
      );
      setLibrary((old) => ({
        ...old,
        runs: [{ ...run, payload: input } as OriginRun, ...old.runs],
      }));
      setInstruction('');
      setMessage('Proposal saved. Review changes before applying them to your draft.');
    } catch (e) {
      setUncertainRun(true);
      setError(
        (e instanceof Error ? e.message : 'Request interrupted.') +
          ' Reload receipts before another request. No automatic retry.',
      );
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }
  function applyRun(run: OriginRun, section?: keyof typeof sections) {
    if (!draft || !selected || !run.output || run.revision !== selected.revision || locked) return;
    if (section) {
      const item = run.output.changes.find((c) => c.section === section);
      if (item && draft.blueprint[section] === selected.content.blueprint[section])
        change({ ...draft, blueprint: { ...draft.blueprint, [section]: item.content } });
      return;
    }
    if (run.kind === 'research') {
      const unique = run.output.sources.filter(
        (s) => !draft.sources.some((old) => old.url === s.url),
      );
      if (draft.sources.length + unique.length > 30) {
        setError('Evidence limit reached; curate references before adding more.');
        return;
      }
      change({ ...draft, sources: [...draft.sources, ...unique] });
      return;
    }
    if (run.output.document) {
      const parsed = generateCommand.safeParse((run as OriginRun & { payload?: unknown }).payload);
      const existing = parsed.success ? parsed.data.documentId : null;
      if (existing && dirty) {
        setError('Save or discard local edits before staging a document revision.');
        return;
      }
      if (!existing && draft.documents.length >= 20) {
        setError('Document limit reached.');
        return;
      }
      const document = {
        id: existing || crypto.randomUUID(),
        ...run.output.document,
        kind: parsed.success ? parsed.data.documentKind : kind,
        status: 'draft' as const,
        basis: run.revision,
      };
      change({
        ...draft,
        documents: [...draft.documents.filter((d) => d.id !== document.id), document],
      });
      setDocumentId(document.id);
      setSurface('Deliverables');
    }
  }
  const libraryNavigation = (
    <nav className="origin-library" aria-label="Project library">
      <button
        disabled={locked}
        aria-current={!selected ? 'page' : undefined}
        onClick={() => {
          if (dirty && !window.confirm('Discard unsaved changes?')) return;
          setSelected(null);
          setDraft(null);
          setConstructDecision(null);
          setHeldPreview(null);
          setError('');
          setMessage('');
          projectLocation(null);
        }}
      >
        New vision +
      </button>
      {library.projects.map((p) => (
        <button
          key={p.id}
          disabled={locked}
          aria-current={p.id === selected?.id ? 'page' : undefined}
          data-bplus-surface={p.id === selected?.id ? 'selection' : undefined}
          onClick={() => void open(p)}
        >
          {p.id === selected?.id && <BplusMaterial radius={8} />}
          {p.content.name}
          <span>
            {p.content.status} · v{p.revision}
          </span>
        </button>
      ))}
    </nav>
  );
  return (
    <section
      className={`origin origin-studio${selected ? ' origin-active' : ''}${foldPanel !== 'canvas' ? ` origin-panel-${foldPanel}` : ''}`}
      data-bplus="architect"
      data-fold-panel={foldPanel}
      aria-labelledby="origin-title"
      aria-busy={busy}
    >
      <header className={`origin-hero${selected ? ' origin-hero-active' : ''}`}>
        <div className="origin-studio-chrome">
          <p className="eyebrow">AETHELIOS / ARCHITECT</p>
          <nav className="origin-studio-tabs" aria-label="Architect">
            <button
              type="button"
              aria-current={studioTab === 'origin' && !selected ? 'page' : undefined}
              onClick={() => {
                setStudioTab('origin');
                if (selected && dirty && !window.confirm('Discard unsaved changes?')) return;
                if (selected) {
                  setSelected(null);
                  setDraft(null);
                  setConstructDecision(null);
                  setHeldPreview(null);
                  projectLocation(null);
                }
              }}
            >
              Origin
            </button>
            <button
              type="button"
              aria-current={studioTab === 'projects' || !!selected ? 'page' : undefined}
              onClick={() => setStudioTab('projects')}
            >
              Projects
            </button>
          </nav>
          <p className="origin-connection-chip">
            {constructEnabled ? 'Construct receipts available' : 'Build connection pending'}
          </p>
        </div>
        <h1 id="origin-title">What will you create?</h1>
        <p>Start with an idea. Shape it together.</p>
        <div className="origin-links">
          <Link href="/app/work">Work</Link>
          <Link href="/app/aethelios">Talk</Link>
          <Link href="/app/studio">Studio</Link>
          <Link href="/app/entities">Council</Link>
        </div>
      </header>
      {!enabled && (
        <ReadinessNotice title="Project persistence is not active.">
          <p>
            Saving is off in this environment. Existing Talk, Studio and Work remain available. Live
            research, generation and publishing stay unavailable — they are not shown as working
            controls.
          </p>
        </ReadinessNotice>
      )}
      <div role="status" className="origin-status" aria-live="polite">
        {busy ? 'Request in progress. ' : ''}
        {message || (!loaded ? 'Loading your project library…' : '')}
      </div>
      {error && (
        <div role="alert" className="origin-notice">
          <p>{error}</p>
          <button onClick={() => void refreshReceipts()} disabled={busy || !enabled}>
            Reload receipts
          </button>
        </div>
      )}
      {selected ? (
        <details className="origin-project-switcher">
          <summary>Projects / switch creation</summary>
          {libraryNavigation}
        </details>
      ) : null}
      {!selected ? (
        <>
          <CreationEntry
            discipline={discipline}
            idea={idea}
            name={name}
            audience={audience}
            constraints={constraints}
            outcome={outcome}
            stage={briefStage}
            locked={locked}
            enabled={enabled}
            pendingReferences={pendingReferences.length}
            projects={library.projects}
            selectedId={null}
            onDiscipline={setDiscipline}
            onIdea={setIdea}
            onName={setName}
            onAudience={setAudience}
            onConstraints={setConstraints}
            onOutcome={setOutcome}
            onStage={setBriefStage}
            onAddReference={() => setAddingReference((open) => !open)}
            onOpenProject={(project) => void open(project)}
            onSubmit={() => {
              void save({
                action: 'save',
                projectId: crypto.randomUUID(),
                requestId: crypto.randomUUID(),
                expected: 0,
                content: shapedContent(),
                note: 'User created project from their vision',
              });
            }}
          />
          {addingReference && (
            <form
              className="origin-reference-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (!safeUrl.safeParse(sourceUrl).success) {
                  setError('Use an HTTP(S) source URL without credentials.');
                  return;
                }
                if (!pendingReferences.some((item) => item.url === sourceUrl))
                  setPendingReferences([
                    ...pendingReferences,
                    { url: sourceUrl, title: sourceTitle, provenance: 'user' },
                  ]);
                setSourceUrl('');
                setSourceTitle('');
                setAddingReference(false);
              }}
            >
              <label>
                Source title
                <input
                  value={sourceTitle}
                  maxLength={160}
                  disabled={locked}
                  onChange={(event) => setSourceTitle(event.target.value)}
                />
              </label>
              <label>
                Source URL
                <input
                  type="url"
                  value={sourceUrl}
                  maxLength={2048}
                  disabled={locked}
                  onChange={(event) => setSourceUrl(event.target.value)}
                />
              </label>
              <button disabled={locked || pendingReferences.length >= 30}>Add to brief</button>
            </form>
          )}
        </>
      ) : (
        draft && (
          <>
            <header className="origin-project-heading">
              <div>
                <p className="eyebrow">
                  {draft.discipline} / {draft.status} / REVISION {selected.revision}
                </p>
                <h2 ref={projectTitle} tabIndex={-1}>
                  {selected.content.name}
                </h2>
              </div>
              <div className="origin-links">
                <button
                  disabled={locked}
                  onClick={() =>
                    change({
                      ...draft,
                      status: draft.status === 'archived' ? 'active' : 'archived',
                    })
                  }
                >
                  {draft.status === 'archived' ? 'Resume project' : 'Archive project'}
                </button>
                <button onClick={() => download(draft.name + '-blueprint', projectMarkdown(draft))}>
                  Export {dirty ? 'draft' : 'blueprint'}
                </button>
                <Link href={`/app/aethelios?conversation=${selected.id}`}>Open project Talk ↗</Link>
              </div>
            </header>
            <WorkbenchHeader
              project={selected}
              draft={draft}
              view={workbenchView}
              connectionLabel={
                constructEnabled ? 'Construct receipts available' : 'Build connection pending'
              }
              onView={openWorkbenchView}
            />
            <nav className="origin-surfaces" aria-label="Project surfaces">
              {surfaces.map((tab) => (
                <button
                  key={tab}
                  aria-current={surface === tab ? 'page' : undefined}
                  data-bplus-surface={surface === tab ? 'selection' : undefined}
                  onClick={() => {
                    setSurface(tab);
                    setHistory(null);
                    if (tab === 'Blueprint') setWorkbenchView('plan');
                    if (tab === 'Conversation') setWorkbenchView('changes');
                    if (tab === 'Deliverables' || tab === 'Research') setWorkbenchView('changes');
                    if (tab === 'History') setWorkbenchView('checks');
                  }}
                >
                  {surface === tab && <BplusMaterial radius={8} />}
                  {tab}
                </button>
              ))}
            </nav>
            {surface !== 'Conversation' &&
              surface !== 'Blueprint' &&
              surface !== 'History' &&
              surface !== 'Construct' && (
              <div className="origin-canvas-tools">
                <button aria-pressed={focusCanvas} onClick={() => setFocusCanvas(!focusCanvas)}>
                  {focusCanvas ? 'Show Aethelios tools' : 'Focus canvas'}
                </button>
              </div>
            )}
            <div
              className={`origin-workspace origin-workbench origin-${surface.toLowerCase()} origin-view-${workbenchView}${focusCanvas && surface !== 'Conversation' && surface !== 'Construct' ? ' origin-canvas-focused' : ''}`}
            >
              <OutlineRail
                draft={draft}
                section={key}
                surface={surface}
                onSection={setKey}
                onSurface={(next) => {
                  setSurface(next);
                  setHistory(null);
                  if (next === 'Blueprint') setWorkbenchView('plan');
                }}
              />
              {(surface === 'Conversation' ||
                surface === 'Research' ||
                surface === 'Deliverables' ||
                workbenchView === 'preview') && (
                <aside
                  className="origin-conversation origin-refine"
                  hidden={focusCanvas && surface !== 'Conversation'}
                >
                  <h3>Refine</h3>
                  <p>
                    {surface === 'Research'
                      ? 'Define the research objective. Search results remain proposals until reviewed.'
                      : surface === 'Deliverables'
                        ? 'Create a document or request a focused revision to the selected document.'
                        : 'Selected work can be refined here. Unsupported generation stays unavailable.'}
                  </p>
                  {!aiEnabled && (
                    <ReadinessNotice title="Model requests are unavailable here.">
                      <p>
                        AI generation and live research are unavailable here. Manual editing,
                        blueprint-based documents and export remain available.
                      </p>
                    </ReadinessNotice>
                  )}
                  {aiEnabled && (
                    <details
                      className="origin-assistant-controls"
                      key={surface}
                      open={surface === 'Conversation'}
                    >
                      <summary>
                        {surface === 'Research'
                          ? 'Plan a research request'
                          : surface === 'Deliverables'
                            ? 'Request creation or revision'
                            : 'Develop the vision'}
                      </summary>
                      <label htmlFor="origin-request">
                        {surface === 'Deliverables'
                          ? 'Document request / targeted revision'
                          : 'Your next request'}
                      </label>
                      <textarea
                        id="origin-request"
                        maxLength={3000}
                        value={instruction}
                        onChange={(e) => setInstruction(e.target.value)}
                        disabled={locked}
                        placeholder="Describe a change…"
                      />
                      {surface === 'Deliverables' && (
                        <label>
                          Deliverable type
                          <select
                            value={kind}
                            onChange={(e) => setKind(e.target.value as typeof kind)}
                            disabled={locked}
                          >
                            {documentKinds.map((k) => (
                              <option key={k}>{k}</option>
                            ))}
                          </select>
                        </label>
                      )}
                      <p>
                        Sending authorizes one bounded model request with this project’s approved
                        context.{' '}
                        {surface === 'Research' && 'Search queries must exclude private details.'}{' '}
                        {dirty && 'Save the draft before asking Aethelios.'}
                      </p>
                      <button
                        className="button"
                        disabled={
                          !aiEnabled ||
                          locked ||
                          dirty ||
                          uncertainRun ||
                          draft.status === 'archived' ||
                          !instruction.trim()
                        }
                        onClick={() =>
                          void generate(
                            surface === 'Research'
                              ? 'research'
                              : surface === 'Deliverables'
                                ? 'document'
                                : 'conversation',
                          )
                        }
                      >
                        Send & prepare proposal
                      </button>
                      {busy && <button onClick={() => abort.current?.abort()}>Stop request</button>}
                      {uncertainRun && (
                        <button disabled={busy} onClick={() => void refreshReceipts()}>
                          Reload request receipts
                        </button>
                      )}
                    </details>
                  )}
                </aside>
              )}
              <section className="origin-plane" aria-label={surface} ref={planeRef}>
                {workbenchView === 'preview' && (
                  <ArtifactCanvas
                    decision={originArtifactDecision()}
                    stale={(() => {
                      const decision = originArtifactDecision();
                      return !!(
                        decision &&
                        decision.kind !== 'unavailable' &&
                        decision.provenance === 'construct' &&
                        decision.identity.revision !== selected.revision
                      );
                    })()}
                    title={draft.name}
                  />
                )}
                {workbenchView === 'checks' && (
                  <aside className="origin-notice origin-checks-pane">
                    <h3>Checks</h3>
                    <p>
                      {constructEnabled
                        ? 'Checks appear only from recorded Construct exit codes. The browser cannot mark them passed.'
                        : 'Construct checks are not in this checkout. Consistency prompts below are field-completeness hints, not validation.'}
                    </p>
                    <ul>
                      {consistencyNotes(draft, selected.revision).map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                    {constructDecision?.kind === 'unavailable' && <p>{constructDecision.reason}</p>}
                  </aside>
                )}
                {surface === 'Conversation' && workbenchView !== 'preview' && (
                  <>
                    <h3>Direction & exploration</h3>
                    <div className="origin-direction">
                      <p>{selected.content.blueprint.vision}</p>
                      <p>
                        <strong>Next move</strong>
                        <br />
                        {selected.content.blueprint.next || 'Define the next action.'}
                      </p>
                      <p>
                        <strong>Open questions</strong>
                        <br />
                        {selected.content.blueprint.risks ||
                          'Ask Aethelios to identify the most consequential uncertainties.'}
                      </p>
                      <button onClick={() => setSurface('Blueprint')}>
                        Open Living Blueprint →
                      </button>
                    </div>
                    <h3>Saved conversation proposals</h3>
                  </>
                )}
                {surface === 'Blueprint' && (
                  <>
                    <div className="origin-editor-heading">
                      <h3>Living Blueprint</h3>
                      <span>{dirty ? 'Unsaved draft' : 'Approved project direction'}</span>
                    </div>
                    <p>
                      Edits become official only when you save a revision. Use decisions to record
                      confirmed choices; keep assumptions and unresolved questions in risks.
                    </p>
                    <details>
                      <summary>Project identity</summary>
                      <label>
                        Name
                        <input
                          value={draft.name}
                          maxLength={100}
                          disabled={locked}
                          onChange={(e) => change({ ...draft, name: e.target.value })}
                        />
                      </label>
                      <label>
                        Description
                        <textarea
                          value={draft.description}
                          maxLength={2000}
                          disabled={locked}
                          onChange={(e) => change({ ...draft, description: e.target.value })}
                        />
                      </label>
                      <label>
                        Status
                        <select
                          value={draft.status}
                          disabled={locked}
                          onChange={(e) =>
                            change({ ...draft, status: e.target.value as ProjectContent['status'] })
                          }
                        >
                          <option>active</option>
                          <option>paused</option>
                          <option>archived</option>
                        </select>
                      </label>
                    </details>
                    <div className="origin-blueprint-canvas">
                      <nav className="origin-outline" aria-label="Blueprint outline">
                        {Object.entries(sections).map(([section, label], index) => (
                          <button
                            key={section}
                            aria-current={key === section ? 'true' : undefined}
                            onClick={() => setKey(section as keyof typeof sections)}
                          >
                            <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                            {label}
                          </button>
                        ))}
                      </nav>
                      <div className="origin-blueprint-writing">
                        <label htmlFor="origin-section">Blueprint section</label>
                        <select
                          id="origin-section"
                          value={key}
                          onChange={(e) => setKey(e.target.value as typeof key)}
                        >
                          {Object.entries(sections).map(([k, label]) => (
                            <option key={k} value={k}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <label htmlFor="origin-section-text">{sections[key]}</label>
                        <textarea
                          id="origin-section-text"
                          className="origin-long-editor"
                          value={draft.blueprint[key]}
                          maxLength={3000}
                          disabled={locked}
                          onChange={(e) =>
                            change({
                              ...draft,
                              blueprint: { ...draft.blueprint, [key]: e.target.value },
                            })
                          }
                        />
                      </div>
                    </div>
                    <details>
                      <summary>Read the complete Blueprint</summary>
                      <ReactMarkdown skipHtml components={markdownComponents}>
                        {projectMarkdown(draft)}
                      </ReactMarkdown>
                    </details>
                    <aside className="origin-notice">
                      <h4>Consistency prompts</h4>
                      <ul>
                        {consistencyNotes(draft, selected.revision).map((n) => (
                          <li key={n}>{n}</li>
                        ))}
                      </ul>
                      <p>
                        These checks identify missing fields and revision age. They are not
                        independent validation.
                      </p>
                    </aside>
                  </>
                )}
                {surface === 'Research' && (
                  <>
                    <h3>Evidence & findings</h3>
                    <p>
                      Provider references are sources consulted, not independently verified facts.
                      User references are not evidence of a live search.
                    </p>
                    <ReactMarkdown skipHtml components={markdownComponents}>
                      {draft.blueprint.research || 'No approved research findings yet.'}
                    </ReactMarkdown>
                    <ul className="origin-sources">
                      {draft.sources.map((s, i) => (
                        <li key={s.url}>
                          <a href={s.url} target="_blank" rel="noopener noreferrer">
                            {s.title || s.url}
                          </a>
                          <span>
                            {s.provenance === 'provider'
                              ? 'Provider-returned source'
                              : 'User-provided reference'}
                          </span>
                          <button
                            disabled={locked}
                            onClick={() =>
                              change({
                                ...draft,
                                sources: draft.sources.filter((_, index) => i !== index),
                              })
                            }
                          >
                            Remove reference
                          </button>
                        </li>
                      ))}
                    </ul>
                    <details>
                      <summary>Add a reference you have reviewed</summary>
                      <label>
                        Source title
                        <input
                          value={sourceTitle}
                          maxLength={160}
                          disabled={locked}
                          onChange={(e) => setSourceTitle(e.target.value)}
                        />
                      </label>
                      <label>
                        Source URL
                        <input
                          type="url"
                          value={sourceUrl}
                          maxLength={2048}
                          disabled={locked}
                          onChange={(e) => setSourceUrl(e.target.value)}
                        />
                      </label>
                      <button
                        disabled={locked || draft.sources.length >= 30}
                        onClick={() => {
                          if (!safeUrl.safeParse(sourceUrl).success) {
                            setError('Use an HTTP(S) source URL without credentials.');
                            return;
                          }
                          if (!draft.sources.some((s) => s.url === sourceUrl))
                            change({
                              ...draft,
                              sources: [
                                ...draft.sources,
                                { url: sourceUrl, title: sourceTitle, provenance: 'user' },
                              ],
                            });
                          setSourceUrl('');
                          setSourceTitle('');
                        }}
                      >
                        Add to draft evidence
                      </button>
                    </details>
                  </>
                )}
                {surface === 'Deliverables' && workbenchView !== 'preview' && (
                  <>
                    <h3>Deliverables</h3>
                    <p>
                      Editable documents, with saved versions in project history. Model drafts and
                      compiled Blueprint drafts require your review.
                    </p>
                    <label>
                      Selected document
                      <select
                        value={documentId ?? ''}
                        onChange={(e) => {
                          const doc = draft.documents.find((d) => d.id === e.target.value);
                          setDocumentId(doc?.id ?? null);
                          if (doc) setKind(doc.kind);
                        }}
                      >
                        <option value="">New document</option>
                        {draft.documents.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.title} · {d.status}
                          </option>
                        ))}
                      </select>
                    </label>
                    {!activeDoc && (
                      <>
                        <label>
                          Document type
                          <select
                            value={kind}
                            onChange={(e) => setKind(e.target.value as typeof kind)}
                          >
                            {documentKinds.map((k) => (
                              <option key={k}>{k}</option>
                            ))}
                          </select>
                        </label>
                        <button
                          disabled={locked || dirty || draft.documents.length >= 20}
                          onClick={() => {
                            const document = {
                              id: crypto.randomUUID(),
                              title: `${draft.name} — ${kind}`.slice(0, 120),
                              kind,
                              content: compileDocument(selected.content, kind),
                              status: 'draft' as const,
                              basis: selected.revision,
                            };
                            change({ ...draft, documents: [...draft.documents, document] });
                            setDocumentId(document.id);
                          }}
                        >
                          Create from approved Blueprint
                        </button>
                        <p>
                          This compiles your approved content into an editable document without a
                          model call. Undefined areas remain explicit open requirements.
                        </p>
                      </>
                    )}
                    {activeDoc && (
                      <>
                        <div className="origin-editor-heading">
                          <span>
                            {activeDoc.status} · Blueprint basis v{activeDoc.basis}
                          </span>
                          <button onClick={() => download(activeDoc.title, activeDoc.content)}>
                            Export Markdown {dirty ? 'draft' : ''}
                          </button>
                          <button onClick={() => window.print()}>Print / PDF</button>
                        </div>
                        <div
                          className="origin-view-controls"
                          role="group"
                          aria-label="Document view"
                        >
                          {(['Edit', 'Preview', 'Split'] as const).map((view) => (
                            <button
                              key={view}
                              aria-pressed={documentView === view}
                              data-bplus-surface={documentView === view ? 'selection' : undefined}
                              onClick={() => setDocumentView(view)}
                            >
                              {documentView === view && <BplusMaterial radius={8} />}
                              {view}
                            </button>
                          ))}
                        </div>
                        <div
                          className={`origin-document-canvas origin-view-${documentView.toLowerCase()}`}
                        >
                          <div
                            className="origin-document-writing"
                            hidden={documentView === 'Preview'}
                          >
                            <label>
                              Document title
                              <input
                                value={activeDoc.title}
                                maxLength={120}
                                disabled={locked}
                                onChange={(e) =>
                                  change({
                                    ...draft,
                                    documents: draft.documents.map((d) =>
                                      d.id === activeDoc.id
                                        ? { ...d, title: e.target.value, status: 'draft' }
                                        : d,
                                    ),
                                  })
                                }
                              />
                            </label>
                            <label>
                              Editable Markdown
                              <textarea
                                className="origin-long-editor"
                                value={activeDoc.content}
                                maxLength={24000}
                                disabled={locked}
                                onChange={(e) =>
                                  change({
                                    ...draft,
                                    documents: draft.documents.map((d) =>
                                      d.id === activeDoc.id
                                        ? { ...d, content: e.target.value, status: 'draft' }
                                        : d,
                                    ),
                                  })
                                }
                              />
                            </label>
                            <button
                              disabled={locked || activeDoc.status === 'approved'}
                              onClick={() =>
                                change({
                                  ...draft,
                                  documents: draft.documents.map((d) =>
                                    d.id === activeDoc.id ? { ...d, status: 'approved' } : d,
                                  ),
                                })
                              }
                            >
                              Mark reviewed & approved in draft
                            </button>
                            <p>
                              Approval records your assessment of this content; save to preserve it.
                              Later edits return it to draft.
                            </p>
                          </div>
                          <article
                            className="origin-document-preview"
                            hidden={documentView === 'Edit'}
                            aria-label="Document preview"
                          >
                            <ReactMarkdown skipHtml components={markdownComponents}>
                              {activeDoc.content}
                            </ReactMarkdown>
                          </article>
                        </div>
                      </>
                    )}
                  </>
                )}
                {surface === 'Construct' && selected && (
                  <ArchitectConstructPanel
                    projectId={selected.id}
                    revision={selected.revision}
                    enabled={constructEnabled}
                    locked={locked}
                  />
                )}
                {surface === 'History' && (
                  <>
                    <h3>Revision history</h3>
                    <p>
                      Each save preserves the complete Blueprint and deliverables. Showing the
                      latest 50 of at most 500 revisions.
                    </p>
                    <button disabled={busy} onClick={() => void refreshReceipts()}>
                      Refresh history
                    </button>
                    <ol className="origin-history">
                      {library.versions.map((v) => (
                        <li key={v.id}>
                          <button onClick={() => setHistory(v)}>
                            Revision {v.revision} — {v.note}
                          </button>
                          <time>{new Date(v.created_at).toLocaleString()}</time>
                        </li>
                      ))}
                    </ol>
                    {library.versions.length > 0 &&
                      library.versions[library.versions.length - 1]!.revision > 1 && (
                        <button disabled={busy} onClick={() => void loadOlderHistory()}>
                          Load earlier revisions
                        </button>
                      )}
                    {history && (
                      <article>
                        <h4>Revision {history.revision}</h4>
                        <ReactMarkdown skipHtml components={markdownComponents}>
                          {projectMarkdown(history.content)}
                        </ReactMarkdown>
                        {history.content.documents.map((d) => (
                          <details key={d.id}>
                            <summary>
                              {d.title} · {d.status}
                            </summary>
                            <ReactMarkdown skipHtml components={markdownComponents}>
                              {d.content}
                            </ReactMarkdown>
                          </details>
                        ))}
                        <button
                          disabled={locked || dirty}
                          onClick={() => {
                            change(structuredClone(history.content));
                            setHistory(null);
                            setMessage(
                              'Historical content restored to an unsaved draft. Save creates a new revision; history remains intact.',
                            );
                          }}
                        >
                          Restore as a new draft
                        </button>
                      </article>
                    )}
                  </>
                )}
                {(surface === 'Conversation' ||
                  surface === 'Research' ||
                  surface === 'Deliverables') && (
                  <div className="origin-proposals">
                    {library.runs
                      .filter(
                        (r) =>
                          surface === 'Conversation' ||
                          (surface === 'Research' ? r.kind === 'research' : r.kind === 'document'),
                      )
                      .map((run) => (
                        <article className="origin-proposal" key={run.id}>
                          <p className="eyebrow">
                            {run.kind} / {run.status} / BASIS v{run.revision}
                          </p>
                          <p>
                            <strong>You</strong> {run.instruction}
                          </p>
                          {run.output ? (
                            <>
                              <ReactMarkdown skipHtml components={markdownComponents}>
                                {run.output.reply}
                              </ReactMarkdown>
                              {run.output.changes.map((c) => (
                                <details key={c.section}>
                                  <summary>{sections[c.section]} — proposed revision</summary>
                                  <p>{c.reason}</p>
                                  <p>
                                    <strong>Approved</strong>
                                  </p>
                                  <pre>
                                    {selected.content.blueprint[c.section] || 'Not defined'}
                                  </pre>
                                  <p>
                                    <strong>Proposed</strong>
                                  </p>
                                  <pre>{c.content}</pre>
                                  <button
                                    disabled={
                                      locked ||
                                      run.revision !== selected.revision ||
                                      draft.blueprint[c.section] !==
                                        selected.content.blueprint[c.section]
                                    }
                                    onClick={() => applyRun(run, c.section)}
                                  >
                                    Accept section into draft
                                  </button>
                                </details>
                              ))}
                              {run.output.document && (
                                <details>
                                  <summary>Preview proposed document</summary>
                                  <ReactMarkdown skipHtml components={markdownComponents}>
                                    {run.output.document.content}
                                  </ReactMarkdown>
                                  <button
                                    disabled={locked || run.revision !== selected.revision}
                                    onClick={() => applyRun(run)}
                                  >
                                    Stage document draft
                                  </button>
                                </details>
                              )}
                              {run.output.sources.length > 0 && (
                                <>
                                  <ul>
                                    {run.output.sources.map((s) => (
                                      <li key={s.url}>
                                        <a href={s.url} target="_blank" rel="noopener noreferrer">
                                          {s.title}
                                        </a>
                                      </li>
                                    ))}
                                  </ul>
                                  <button
                                    disabled={locked || run.revision !== selected.revision}
                                    onClick={() => applyRun(run)}
                                  >
                                    Accept sources into draft
                                  </button>
                                </>
                              )}
                              {run.revision !== selected.revision && (
                                <p>
                                  This proposal uses an earlier revision. Its content remains
                                  readable; ask for a fresh review before applying it.
                                </p>
                              )}
                            </>
                          ) : (
                            <p>
                              {run.status === 'running'
                                ? 'No completion receipt. The request may have been interrupted; no automatic replay.'
                                : 'Request failed. Approved content was preserved.'}
                            </p>
                          )}
                        </article>
                      ))}
                  </div>
                )}
              </section>
            </div>
            <RevisionStrip
              versions={library.versions}
              currentRevision={selected.revision}
              compareId={compareId}
              onSelect={(version) => {
                setCompareId(version?.id ?? null);
                if (version) setHistory(version);
              }}
            />
            {compareId && history && (
              <article className="origin-compare" aria-label="Revision comparison">
                <h3>
                  Comparing revision {history.revision} with current revision {selected.revision}
                </h3>
                <p>Restoration stays a draft until you save. Publishing remains unavailable.</p>
                <pre>{projectMarkdown(history.content)}</pre>
              </article>
            )}
            <FoldDock panel={foldPanel} onPanel={setFoldPanel} />
            <footer className="origin-savebar">
              <p>
                {pending
                  ? 'Save outcome unconfirmed. Exact draft retained.'
                  : dirty
                    ? 'Unsaved draft — approved content is unchanged.'
                    : `All changes saved · revision ${selected.revision}`}
              </p>
              <button
                className="button"
                data-bplus-surface="action"
                disabled={busy || (!dirty && !pending)}
                onClick={() => void save()}
              >
                <BplusMaterial radius={8} />
                {pending ? 'Retry same save' : 'Save & confirm revision'}
              </button>
              {dirty && !pending && (
                <button
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm('Discard this unsaved draft?')) {
                      const current =
                        library.projects.find((p) => p.id === selected.id) ?? selected;
                      setSelected(current);
                      setDraft(structuredClone(current.content));
                      setMessage('Draft discarded. Approved content retained.');
                    }
                  }}
                >
                  Discard draft
                </button>
              )}
              {pending && (
                <>
                  <button disabled={busy} onClick={() => void refreshReceipts()}>
                    Inspect save receipt
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          'Keep a copy of this draft and release the replay lock? Export first if needed. Reload current project before saving again.',
                        )
                      ) {
                        setPending(null);
                        setMessage(
                          'Draft retained. Reopen current project to resolve stale changes before saving.',
                        );
                      }
                    }}
                  >
                    Recover editing
                  </button>
                </>
              )}
            </footer>
          </>
        )
      )}
      {!selected && pending && (
        <aside className="origin-notice">
          <p>Create outcome unconfirmed. The original IDs and content are retained.</p>
          <button onClick={() => download(pending.content.name, projectMarkdown(pending.content))}>
            Export retained draft
          </button>
          <button disabled={busy} onClick={() => void save()}>
            Retry same save
          </button>
          <button disabled={busy} onClick={() => void refreshReceipts()}>
            Inspect save receipt
          </button>
        </aside>
      )}
    </section>
  );
}
