'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ContextSheet } from '@/components/interaction/context-sheet';
import {
  architectDiagnostics,
  architectUnavailableMessage,
  type TrustedPresentation,
} from '@/domains/health/architect-adapter';
import { selectMarkersByName } from '@/domains/health/bloodwork';
import {
  applyCompositionCommand,
  createComposedTool,
  interpretHealthCreation,
  pushToolHistory,
  resolveComposition,
} from '@/domains/health/composition';
import { type HealthFoundationId } from '@/domains/health/foundations';
import {
  proposeConstraintChange,
  tickRoutineTimer,
  type RoutineProgress,
} from '@/domains/health/routine';
import { sampleBloodwork } from '@/domains/health/sample';
import type { HealthData, HealthSendResult, Mutation } from '@/domains/health/schema';
import { canLeaveAfterSave, shouldClearDraft } from '@/domains/health/save-receipts';
import {
  defaultBloodworkSettings,
  type HealthWorkspaceRecord,
  type SelectedElement,
} from '@/domains/health/workspace-model';
import { ArchitectWorkbench } from './architect-workbench';
import { CompositionPane } from './composition-pane';
import { ComposedTool } from './composed-tool';
import { CreationHome } from './creation-home';
import { eveningStepTitle } from './routine-tool';

const archive: [string, string][] = [
  ['/app/health/history', 'History'],
  ['/app/health/records', 'Records'],
  ['/app/health/labs', 'Labs'],
  ['/app/health/connections', 'Connections'],
  ['/app/health/privacy', 'Privacy'],
];

type PendingNav =
  | { kind: 'saved'; id: string }
  | { kind: 'foundation'; id: HealthFoundationId; sample?: boolean }
  | { kind: 'home' }
  | { kind: 'restore' };

export function HealthAtelier({
  data,
  send,
  busy,
  blocked,
  recovery,
}: {
  data: HealthData;
  send: (body?: Mutation | FormData, endpoint?: string) => Promise<HealthSendResult | void>;
  busy: boolean;
  blocked: boolean;
  recovery: ReactNode;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<HealthWorkspaceRecord | null>(null);
  const [selected, setSelected] = useState<SelectedElement | null>(null);
  const [section, setSection] = useState<'workspace' | 'library' | 'archive'>('workspace');
  const [architect, setArchitect] = useState(false);
  const [customize, setCustomize] = useState(false);
  const [paneOpen, setPaneOpen] = useState(false);
  const [assist, setAssist] = useState('');
  const [assistNote, setAssistNote] = useState('');
  const [composer, setComposer] = useState('');
  const [receipt, setReceipt] = useState<HealthSendResult | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [pendingNav, setPendingNav] = useState<PendingNav | null>(null);
  const [past, setPast] = useState<HealthWorkspaceRecord[]>([]);
  const [future, setFuture] = useState<HealthWorkspaceRecord[]>([]);
  const surface = useRef<HTMLElement>(null);
  const scroll = useRef(0);
  const ownerRef = useRef(data.owner);
  ownerRef.current = data.owner;
  const generation = useRef(0);
  const signedIn = data.mode === 'personal';
  const lock = busy || (signedIn && blocked);
  const saved = useMemo(
    () =>
      data.workspaces.filter(
        (row) => row.foundation === 'evening-routine' || row.foundation === 'bloodwork-tracker',
      ),
    [data.workspaces],
  );
  const stored = selectedId ? (saved.find((row) => row.id === selectedId) ?? null) : null;
  const current = draft
    ? stored && stored.id === draft.id
      ? {
          ...draft,
          version: stored.version,
          architect: stored.architect,
          workingRevision: stored.workingRevision,
          lastWorkingRevision: stored.lastWorkingRevision,
        }
      : draft
    : stored;
  const dirty = Boolean(draft);
  const savedArchitect = current ? saved.find((row) => row.id === current.id) : null;
  const sampleBloodworkNeeded = !data.observations.some((row) => row.status === 'active');

  useEffect(() => {
    if (!current?.progress?.timer?.running) return;
    const fenceOwner = data.owner;
    const fenceId = current.id;
    const fenceGeneration = generation.current;
    const id = window.setInterval(() => {
      if (ownerRef.current !== fenceOwner || generation.current !== fenceGeneration) return;
      setDraft((workspace) => {
        if (!workspace || workspace.id !== fenceId || !workspace.progress?.timer) return workspace;
        const timer = tickRoutineTimer(workspace.progress.timer);
        return { ...workspace, progress: { ...workspace.progress, timer } };
      });
    }, 250);
    return () => window.clearInterval(id);
  }, [current?.id, current?.progress?.timer?.running, data.owner]);

  useEffect(() => {
    const node = surface.current;
    if (!node) return;
    const restore = () => {
      node.scrollTop = scroll.current;
    };
    const store = () => {
      scroll.current = node.scrollTop;
    };
    node.addEventListener('scroll', store);
    window.addEventListener('resize', restore);
    return () => {
      node.removeEventListener('scroll', store);
      window.removeEventListener('resize', restore);
    };
  }, [current?.id]);

  function replace(next: HealthWorkspaceRecord) {
    if (current) setPast((history) => pushToolHistory(history, current));
    setFuture([]);
    generation.current += 1;
    setSelectedId(next.id);
    setDraft(next);
  }

  function undo() {
    const previous = past[past.length - 1];
    if (!previous || !current) return;
    setPast(past.slice(0, -1));
    setFuture((history) => pushToolHistory(history, current));
    generation.current += 1;
    setSelectedId(previous.id);
    setDraft(previous);
  }

  function redo() {
    const next = future[future.length - 1];
    if (!next || !current) return;
    setFuture(future.slice(0, -1));
    setPast((history) => pushToolHistory(history, current));
    generation.current += 1;
    setSelectedId(next.id);
    setDraft(next);
  }

  function openSaved(id: string) {
    setSelectedId(id);
    setDraft(null);
    setArchitect(false);
    setCustomize(false);
    setSection('workspace');
    setPast([]);
    setFuture([]);
    setSelected(null);
  }

  function openHome() {
    setSelectedId(null);
    setDraft(null);
    setArchitect(false);
    setCustomize(false);
    setSection('workspace');
    setPast([]);
    setFuture([]);
    setSelected(null);
  }

  function openFoundation(foundation: HealthFoundationId, sample = false) {
    const created = createComposedTool({
      foundation,
      sample:
        sample ||
        (foundation === 'bloodwork-tracker' && sampleBloodworkNeeded),
    });
    setSelectedId(created.id);
    setDraft(created);
    setArchitect(false);
    setCustomize(false);
    setSection('workspace');
    setPast([]);
    setFuture([]);
    setSelected(null);
  }

  function requestLeave(next: PendingNav) {
    if (!dirty) {
      applyNav(next);
      return;
    }
    setPendingNav(next);
    setLeaveOpen(true);
  }

  function applyNav(next: PendingNav) {
    setLeaveOpen(false);
    setPendingNav(null);
    if (next.kind === 'saved') openSaved(next.id);
    if (next.kind === 'foundation') openFoundation(next.id, next.sample);
    if (next.kind === 'home') openHome();
    if (next.kind === 'restore') void restoreLast(true);
  }

  async function finishSend(
    workspace: HealthWorkspaceRecord,
    sentGeneration: number,
    result: HealthSendResult | void,
  ): Promise<HealthSendResult> {
    const outcome: HealthSendResult = result ?? {
      status: 'uncertain',
      message: 'The last request may have reached the server.',
    };
    setReceipt(outcome);
    setDraft((currentDraft) =>
      shouldClearDraft(currentDraft, workspace.id, sentGeneration, generation.current, outcome)
        ? null
        : currentDraft,
    );
    return outcome;
  }

  async function saveWorkspace(
    workspace = current,
    asCopy = false,
  ): Promise<HealthSendResult> {
    if (!workspace) return { status: 'failed', message: 'Nothing to save.' };
    if (!signedIn) {
      return { status: 'failed', message: 'Sign in to save this tool. The draft is still here.' };
    }
    if (data.mode === 'unavailable') {
      return {
        status: 'failed',
        message: 'Health storage is not available in this environment. The draft is still here.',
      };
    }
    const request = crypto.randomUUID();
    const sentGeneration = generation.current;
    if (asCopy) {
      if (!saved.some((row) => row.id === workspace.id)) {
        return saveWorkspace(
          { ...workspace, id: crypto.randomUUID(), title: `${workspace.title} copy` },
          false,
        );
      }
      const result = await send({
        kind: 'workspace_copy',
        request,
        id: crypto.randomUUID(),
        sourceId: workspace.id,
        title: `${workspace.title} copy`,
        includeDraft: dirty,
        settings: dirty ? workspace.settings : undefined,
        progress: dirty ? workspace.progress : undefined,
        architect: dirty ? workspace.architect : undefined,
      });
      return finishSend(workspace, sentGeneration, result);
    }
    const expected = saved.some((row) => row.id === workspace.id) ? workspace.version : 1;
    const result = await send({
      kind: 'workspace_save',
      request,
      id: workspace.id,
      expected,
      foundation: workspace.foundation,
      title: workspace.title,
      sample: workspace.sample,
      settings: workspace.settings,
      progress: workspace.progress
        ? {
            constraint: workspace.progress.constraint,
            accepted: workspace.progress.accepted,
            pending: workspace.progress.pending,
            timer: workspace.progress.timer,
            completed: workspace.progress.completed,
            notes: workspace.progress.notes,
            activeStepId: workspace.progress.activeStepId,
          }
        : null,
      architect: workspace.architect,
      open: true,
    });
    return finishSend(workspace, sentGeneration, result);
  }

  async function restoreLast(confirmed = false) {
    if (!current || !signedIn) return;
    if (dirty && !confirmed) {
      requestLeave({ kind: 'restore' });
      return;
    }
    const sentGeneration = generation.current;
    const result = await send({
      kind: 'workspace_restore',
      request: crypto.randomUUID(),
      id: current.id,
      expected: current.version,
      revision: Math.max(1, current.version - 1),
    });
    await finishSend(current, sentGeneration, result);
  }

  function applyCreation(text: string, fromHome = false) {
    const intent = interpretHealthCreation(text);
    if (intent.kind === 'blank') {
      const created = createComposedTool({ blank: true, intent: text, sample: false });
      setSelectedId(created.id);
      setDraft(created);
      setCustomize(true);
      setAssistNote(intent.reason);
      return;
    }
    if (intent.kind === 'handoff') {
      const created = createComposedTool({
        blank: true,
        intent: text,
        title: text.slice(0, 80) || 'Untitled tool',
      });
      setSelectedId(created.id);
      setDraft(created);
      setCustomize(true);
      setArchitect(false);
      setAssistNote(intent.reason);
      return;
    }
    if (intent.kind === 'command') {
      if (!current) {
        setAssistNote('Open or create a tool before changing its structure.');
        return;
      }
      const result = applyCompositionCommand(current, intent.command, data.observations);
      replace(result.workspace);
      setCustomize(true);
      setAssistNote(result.note || intent.reason);
      return;
    }
    if (intent.kind !== 'assist') return;
    const action = intent.action;
    setAssistNote(action.reason);
    if (action.kind === 'open') {
      if (fromHome || !current) openFoundation(action.foundation);
      else requestLeave({ kind: 'foundation', id: action.foundation });
      return;
    }
    if (action.kind === 'help') return;
    let tool = current;
    if (!tool) {
      tool = createComposedTool({
        foundation: action.kind === 'markers' ? 'bloodwork-tracker' : 'evening-routine',
        intent: text,
        sample: action.kind === 'markers' && sampleBloodworkNeeded,
      });
      setSelectedId(tool.id);
      setDraft(tool);
    }
    if (action.kind === 'minutes' && tool.progress) {
      replace({
        ...tool,
        progress: proposeConstraintChange(tool.progress, { availableMinutes: action.minutes }),
      });
    }
    if (action.kind === 'finish' && tool.progress) {
      replace({
        ...tool,
        progress: proposeConstraintChange(tool.progress, { finishAt: action.finishAt }),
      });
    }
    if (action.kind === 'markers') {
      const source = tool.sample ? sampleBloodwork : data.observations;
      const markerKeys = selectMarkersByName(source, action.names);
      const prepared = resolveComposition(tool).sections.some((item) => item.kind === 'trend')
        ? tool
        : applyCompositionCommand(tool, { kind: 'add-section', sectionKind: 'trend' }, data.observations)
            .workspace;
      replace({
        ...prepared,
        settings: {
          ...prepared.settings,
          bloodwork: {
            ...(prepared.settings.bloodwork ?? defaultBloodworkSettings()),
            markerKeys,
            focusKey: markerKeys[0] ?? null,
          },
        },
      });
    }
  }

  const inspector = current ? inspectorCopy(current, selected) : null;
  const diagnostics = architectDiagnostics();
  const owned = Boolean(current && saved.some((row) => row.id === current.id) && !dirty);

  return (
    <div
      className="health-atelier"
      data-section={section}
      data-architect={architect}
      data-mode={current ? 'canvas' : 'home'}
      data-customize={customize}
    >
      <nav className="health-rail" aria-label="Health workspace">
        <p className="health-kicker">Health</p>
        <button type="button" className="health-rail-item" onClick={() => requestLeave({ kind: 'home' })}>
          Creation home
        </button>
        <div className="health-mobile-sections" role="tablist" aria-label="Health sections">
          {(
            [
              ['workspace', 'Workspace'],
              ['library', 'Library'],
              ['archive', 'Records'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={section === id}
              onClick={() => setSection(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="health-rail-block">
          <p className="health-kicker">Saved</p>
          {saved.length ? (
            saved.map((row) => (
              <button
                key={row.id}
                type="button"
                className="health-rail-item"
                aria-current={current?.id === row.id ? 'page' : undefined}
                onClick={() => requestLeave({ kind: 'saved', id: row.id })}
              >
                {row.title}
                <small>
                  {row.foundation === 'evening-routine' ? 'Routine' : 'Bloodwork'}
                  {row.sample ? ' · sample' : ''} · v{row.version}
                </small>
              </button>
            ))
          ) : (
            <p>No saved tool yet.</p>
          )}
        </div>
        <div className="health-rail-block">
          <p className="health-kicker">Foundations</p>
          <button
            type="button"
            className="health-rail-item"
            onClick={() => requestLeave({ kind: 'foundation', id: 'evening-routine' })}
          >
            Evenings, made usable
            <small>A short cooking sequence after work.</small>
          </button>
          <button
            type="button"
            className="health-rail-item"
            onClick={() =>
              requestLeave({
                kind: 'foundation',
                id: 'bloodwork-tracker',
                sample: sampleBloodworkNeeded,
              })
            }
          >
            Bloodwork Tracker
            <small>Chronological laboratory evidence.</small>
          </button>
        </div>
        <div className="health-rail-archive">
          <p className="health-kicker">Records & privacy</p>
          {archive.map(([href, label]) => (
            <Link key={href} href={href} prefetch={false}>
              {label}
            </Link>
          ))}
        </div>
      </nav>
      <div className="health-stage">
        {recovery}
        {current ? (
          <>
            <div className="health-context">
              <div>
                <p className="health-kicker">{owned ? 'Your tool' : dirty ? 'Draft' : 'Active tool'}</p>
                <h1>{current.title}</h1>
                <p>
                  {dirty ? 'Unsaved edits' : signedIn && owned ? 'Saved' : signedIn ? 'Not saved yet' : 'Not signed in'}
                  {current.sample ? ' · labelled sample' : ''}
                  {` · v${current.version}`}
                </p>
              </div>
              <div className="health-context-actions">
                <button type="button" onClick={() => requestLeave({ kind: 'home' })}>
                  All tools
                </button>
                <button
                  type="button"
                  aria-pressed={!customize}
                  onClick={() => setCustomize(false)}
                >
                  Use
                </button>
                <button
                  type="button"
                  aria-pressed={customize}
                  onClick={() => setCustomize(true)}
                >
                  Customize
                </button>
                {customize && (
                  <button
                    type="button"
                    className="health-mobile-inspect"
                    onClick={() => setPaneOpen(true)}
                  >
                    Structure
                  </button>
                )}
                <button disabled={!past.length} onClick={undo}>
                  Undo
                </button>
                <button disabled={!future.length} onClick={redo}>
                  Redo
                </button>
                <button disabled={lock || !dirty || !signedIn} onClick={() => void saveWorkspace()}>
                  Save
                </button>
                <button
                  disabled={
                    lock || !signedIn || (!dirty && !saved.some((row) => row.id === current.id))
                  }
                  onClick={() => void saveWorkspace(current, true)}
                  title="Copies the current working surface, including unsaved edits."
                >
                  Save as copy
                </button>
                <button
                  disabled={lock || !signedIn || current.version < 2}
                  onClick={() => void restoreLast()}
                >
                  Restore last
                </button>
                <button type="button" onClick={() => setArchitect(true)}>
                  Architect brief
                </button>
              </div>
            </div>
            {data.mode === 'signed-out' && (
              <div className="health-notice" role="status">
                <p>Sign in to keep this tool. Foundations still open as a labelled sample or local draft.</p>
                <Link href="/enter">Sign in</Link>
              </div>
            )}
            {data.mode === 'unavailable' && (
              <div className="health-notice" role="status">
                <p>Health storage is not available in this environment. The draft stays here and has not been saved.</p>
              </div>
            )}
            {receipt && receipt.status !== 'confirmed' && receipt.status !== 'ignored' && (
              <div className="health-notice" role="status" data-save-receipt={receipt.status}>
                <p>
                  {receipt.status === 'failed'
                    ? `Save failed. Your edits are still here. ${receipt.message}`
                    : `Save is uncertain. Your edits are still here. ${receipt.message}`}
                </p>
              </div>
            )}
            <div className="health-canvas-split">
              <section
                className="health-surface"
                ref={surface}
                tabIndex={-1}
                aria-label="Active Health tool"
              >
                {architect ? (
                  <ArchitectWorkbench
                    workspace={current}
                    blocked={lock}
                    onPresentation={(presentation: TrustedPresentation) =>
                      replace({
                        ...current,
                        settings: {
                          ...current.settings,
                          presentation,
                          bloodwork: current.settings.bloodwork
                            ? {
                                ...current.settings.bloodwork,
                                dateRange: presentation.dateRange,
                                comparisonDrawer: presentation.comparisonDrawer,
                                density: presentation.density,
                                arrangement:
                                  presentation.arrangement === 'sequence'
                                    ? current.settings.bloodwork.arrangement
                                    : presentation.arrangement,
                              }
                            : current.settings.bloodwork,
                        },
                      })
                    }
                    onCompile={(instruction) => {
                      if (!signedIn) return;
                      if (!savedArchitect) {
                        setReceipt({
                          status: 'failed',
                          message: 'Save this workspace before compiling a customization.',
                        });
                        return;
                      }
                      void send({
                        kind: 'workspace_architect',
                        request: crypto.randomUUID(),
                        id: current.id,
                        expected: current.version,
                        action: 'compile',
                        instruction,
                      });
                    }}
                    onAccept={() => {
                      if (!signedIn) return;
                      void send({
                        kind: 'workspace_architect',
                        request: crypto.randomUUID(),
                        id: current.id,
                        expected: current.version,
                        action: 'accept',
                      });
                    }}
                    onClose={() => setArchitect(false)}
                  />
                ) : (
                  <ComposedTool
                    workspace={current}
                    observations={data.observations}
                    records={data.records}
                    selected={selected}
                    blocked={lock}
                    customize={customize}
                    onChange={(progress: RoutineProgress) => replace({ ...current, progress })}
                    onBloodwork={(bloodwork) =>
                      replace({ ...current, settings: { ...current.settings, bloodwork } })
                    }
                    onSelect={setSelected}
                  />
                )}
              </section>
              {customize && !architect && (
                <aside className="health-inspector" aria-label="Tool structure">
                  <CompositionPane
                    workspace={current}
                    selected={selected}
                    observations={data.observations}
                    blocked={lock}
                    onApply={(next, note) => {
                      replace(next);
                      setAssistNote(note);
                    }}
                  />
                </aside>
              )}
            </div>
            <form
              className="health-dock"
              onSubmit={(event) => {
                event.preventDefault();
                applyCreation(assist);
                setAssist('');
              }}
            >
              <label>
                Change your tool…
                <input
                  value={assist}
                  maxLength={300}
                  placeholder="Add notes, remove the table, or show LDL"
                  onChange={(event) => setAssist(event.target.value)}
                />
              </label>
              <button type="submit">Apply</button>
              {assistNote && <p role="status">{assistNote}</p>}
            </form>
          </>
        ) : (
          <CreationHome
            data={data}
            saved={saved}
            composer={composer}
            note={assistNote}
            signedIn={signedIn}
            onComposer={setComposer}
            onCreate={() => {
              applyCreation(composer || 'blank tool', true);
              setComposer('');
            }}
            onOpenSaved={(id) => requestLeave({ kind: 'saved', id })}
            onOpenFoundation={(id, sample) => requestLeave({ kind: 'foundation', id, sample })}
          />
        )}
      </div>
      {!customize && current && (
        <aside className="health-inspector health-use-inspector" aria-label="Selection inspector">
          {inspector ? (
            <>
              <p className="health-kicker">Selected</p>
              <h2>{inspector.title}</h2>
              <p>{inspector.body}</p>
              <p className="health-footnote">{inspector.source}</p>
            </>
          ) : (
            <>
              <p className="health-kicker">Use</p>
              <p>The tool stays in the center. Select a step or marker when you need its detail.</p>
              <p className="health-footnote">{architectUnavailableMessage()}</p>
            </>
          )}
        </aside>
      )}
      <ContextSheet open={paneOpen && customize} title="Customize" onClose={() => setPaneOpen(false)}>
        {current && (
          <CompositionPane
            workspace={current}
            selected={selected}
            observations={data.observations}
            blocked={lock}
            onApply={(next, note) => {
              replace(next);
              setAssistNote(note);
            }}
          />
        )}
      </ContextSheet>
      <ContextSheet
        open={leaveOpen}
        title="Keep these edits?"
        onClose={() => {
          setLeaveOpen(false);
          setPendingNav(null);
        }}
      >
        <div className="health-dialog">
          <p>The current workspace has unsaved changes.</p>
          <button type="button" onClick={() => pendingNav && applyNav(pendingNav)}>
            Discard changes
          </button>
          <button
            type="button"
            disabled={lock || !signedIn}
            onClick={() => {
              const destination = pendingNav;
              void saveWorkspace().then((result) => {
                if (canLeaveAfterSave(result) && destination) applyNav(destination);
              });
            }}
          >
            Save and continue
          </button>
          <button
            type="button"
            onClick={() => {
              setLeaveOpen(false);
              setPendingNav(null);
            }}
          >
            Keep editing
          </button>
        </div>
      </ContextSheet>
      <p hidden data-health-diagnostics="atelier-dependency">
        {diagnostics.commit}
      </p>
    </div>
  );
}

function inspectorCopy(workspace: HealthWorkspaceRecord, selected: SelectedElement | null) {
  const composition = resolveComposition(workspace);
  if (selected?.kind === 'section') {
    const section = composition.sections.find((item) => item.id === selected.id);
    return {
      title: section?.title ?? 'Section',
      body: 'This piece can be renamed, reordered or removed. Source records stay in Health.',
      source: workspace.sample ? 'Synthetic sample workspace' : 'Private Health workspace',
    };
  }
  if (!selected)
    return {
      title: workspace.title,
      body: 'Use the tool in the center. Customize adds or rearranges supported sections without hiding it.',
      source: workspace.sample ? 'Synthetic sample workspace' : 'Private Health workspace',
    };
  if (selected.kind === 'constraint')
    return {
      title: selected.id === 'minutes' ? 'Available minutes' : 'Finish time',
      body: 'Changing a constraint proposes a packed sequence. Accept it before timers and completion follow the new limit.',
      source: 'Bounded Health planner · not unrestricted model reasoning',
    };
  if (selected.kind === 'timer')
    return {
      title: 'In-app timer',
      body: 'This countdown runs in the Health workspace. It does not start a kitchen device or a medical instrument.',
      source: 'Host-controlled timer state',
    };
  if (selected.kind === 'step')
    return {
      title: eveningStepTitle(selected.id as Parameters<typeof eveningStepTitle>[0]),
      body:
        workspace.progress?.notes[selected.id as keyof RoutineProgress['notes']] ||
        'A selected step in the accepted sequence.',
      source: 'Evening foundation · in-app action',
    };
  if (selected.kind === 'marker')
    return {
      title: 'Reviewed marker',
      body: 'Original units, collection date and laboratory range stay host-controlled. Generated presentation cannot replace them.',
      source: workspace.sample ? 'Synthetic sample workspace' : 'Reviewed Health records',
    };
  return {
    title: 'Working element',
    body: 'Settings apply to presentation. Clinical rules stay in trusted Health code.',
    source: workspace.title,
  };
}
