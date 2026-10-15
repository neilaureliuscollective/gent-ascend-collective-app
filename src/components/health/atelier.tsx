'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ContextSheet } from '@/components/interaction/context-sheet';
import { interpretHealthAssist } from '@/domains/health/assist';
import type { TrustedPresentation } from '@/domains/health/architect-adapter';
import {
  ARCHITECT_APPS_DEPENDENCY,
  type ArchitectAttempt,
} from '@/domains/health/architect-adapter';
import { foundationLibrary, type HealthFoundationId } from '@/domains/health/foundations';
import {
  proposeConstraintChange,
  tickRoutineTimer,
  type RoutineProgress,
} from '@/domains/health/routine';
import type { HealthData, Mutation } from '@/domains/health/schema';
import {
  createWorkspaceDraft,
  defaultBloodworkSettings,
  type HealthWorkspaceRecord,
  type SelectedElement,
} from '@/domains/health/workspace-model';
import { ArchitectWorkbench } from './architect-workbench';
import { BloodworkTool } from './bloodwork-tool';
import { eveningStepTitle, RoutineTool } from './routine-tool';

const archive: [string, string][] = [
  ['/app/health/history', 'History'],
  ['/app/health/records', 'Records'],
  ['/app/health/labs', 'Labs'],
  ['/app/health/connections', 'Connections'],
  ['/app/health/privacy', 'Privacy'],
];

export function HealthAtelier({
  data,
  send,
  busy,
  blocked,
  recovery,
}: {
  data: HealthData;
  send: (body?: Mutation | FormData, endpoint?: string) => Promise<void>;
  busy: boolean;
  blocked: boolean;
  recovery: ReactNode;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<HealthWorkspaceRecord | null>(null);
  const [selected, setSelected] = useState<SelectedElement | null>(null);
  const [section, setSection] = useState<'workspace' | 'library' | 'archive'>('workspace');
  const [inspect, setInspect] = useState(false);
  const [architect, setArchitect] = useState(false);
  const [assist, setAssist] = useState('');
  const [assistNote, setAssistNote] = useState('');
  const surface = useRef<HTMLElement>(null);
  const scroll = useRef(0);
  const signedIn = data.mode === 'personal';
  const lock = busy || (signedIn && blocked);
  const saved = useMemo(
    () =>
      data.workspaces.filter(
        (row) => row.foundation === 'evening-routine' || row.foundation === 'bloodwork-tracker',
      ),
    [data.workspaces],
  );
  const current = draft ?? saved.find((row) => row.id === selectedId) ?? saved[0] ?? null;
  const dirty = Boolean(draft);

  useEffect(() => {
    if (!current?.progress?.timer?.running) return;
    const baseline = current;
    const id = window.setInterval(() => {
      setDraft((workspace) => {
        const base = workspace ?? baseline;
        if (!base.progress?.timer) return workspace;
        const timer = tickRoutineTimer(base.progress.timer);
        return { ...base, progress: { ...base.progress, timer } };
      });
    }, 250);
    return () => window.clearInterval(id);
  }, [current]);

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
    setSelectedId(next.id);
    setDraft(next);
  }

  function openFoundation(foundation: HealthFoundationId, sample = false) {
    const existing = saved.find((row) => row.foundation === foundation && row.sample === sample);
    if (existing) {
      setSelectedId(existing.id);
      setDraft(null);
      setArchitect(false);
      setSection('workspace');
      return;
    }
    const created = createWorkspaceDraft(foundation, {
      sample:
        sample ||
        (foundation === 'bloodwork-tracker' &&
          !data.observations.some((row) => row.status === 'active')),
    });
    setSelectedId(created.id);
    setDraft(created);
    setArchitect(false);
    setSection('workspace');
  }

  async function saveWorkspace(workspace = current, asCopy = false) {
    if (!workspace || !signedIn) return;
    const request = crypto.randomUUID();
    if (asCopy) {
      await send({
        kind: 'workspace_copy',
        request,
        id: crypto.randomUUID(),
        sourceId: workspace.id,
        title: `${workspace.title} copy`,
      });
      setDraft(null);
      return;
    }
    const expected = saved.some((row) => row.id === workspace.id) ? workspace.version : 1;
    await send({
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
    setDraft(null);
  }

  async function restoreLast() {
    if (!current || !signedIn) return;
    await send({
      kind: 'workspace_restore',
      request: crypto.randomUUID(),
      id: current.id,
      expected: current.version,
      revision: Math.max(1, current.version - 1),
    });
    setDraft(null);
  }

  function applyAssist(text: string) {
    const action = interpretHealthAssist(text);
    setAssistNote(action.reason);
    if (action.kind === 'open') openFoundation(action.foundation);
    if (action.kind === 'minutes' && current?.progress)
      replace({
        ...current,
        progress: proposeConstraintChange(current.progress, { availableMinutes: action.minutes }),
      });
    if (action.kind === 'finish' && current?.progress)
      replace({
        ...current,
        progress: proposeConstraintChange(current.progress, { finishAt: action.finishAt }),
      });
    if (action.kind === 'markers' && current?.foundation === 'bloodwork-tracker') {
      replace({
        ...current,
        settings: {
          ...current.settings,
          bloodwork: {
            ...(current.settings.bloodwork ?? defaultBloodworkSettings()),
            markerKeys: [],
          },
        },
      });
    }
  }

  const inspector = current && selected ? inspectorCopy(current, selected) : null;
  const sampleBloodwork = !data.observations.some((row) => row.status === 'active');

  return (
    <div className="health-atelier" data-section={section} data-architect={architect}>
      <nav className="health-rail" aria-label="Health workspace">
        <p className="health-kicker">Health</p>
        <p className="health-rail-lead">A personal environment. Open a foundation and keep it.</p>
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
                onClick={() => {
                  setSelectedId(row.id);
                  setDraft(null);
                  setArchitect(false);
                  setSection('workspace');
                }}
              >
                {row.title}
                <small>
                  {row.foundation === 'evening-routine' ? 'Routine' : 'Bloodwork'}
                  {row.sample ? ' · sample' : ''} · v{row.version}
                </small>
              </button>
            ))
          ) : (
            <p>No saved workspace yet. Open a foundation.</p>
          )}
        </div>
        <div className="health-rail-block">
          <p className="health-kicker">Foundations</p>
          {foundationLibrary.map((item) => (
            <button
              key={item.id}
              type="button"
              className="health-rail-item"
              onClick={() =>
                openFoundation(item.id, item.id === 'bloodwork-tracker' && sampleBloodwork)
              }
            >
              {item.title}
              <small>{item.intention}</small>
            </button>
          ))}
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
        <div className="health-context">
          <div>
            <p className="health-kicker">Working surface</p>
            <h1>{current?.title ?? 'A personal Health workspace'}</h1>
            <p>
              {current
                ? `${current.foundation === 'evening-routine' ? 'Evening sequence' : 'Bloodwork Tracker'} · ${
                    dirty ? 'Unsaved edits' : signedIn ? 'Saved' : 'Not signed in'
                  } · v${current.version}`
                : 'Open a ready foundation. You do not need to design an app first.'}
            </p>
          </div>
          <div className="health-context-actions">
            {current && (
              <>
                <button disabled={lock || !dirty || !signedIn} onClick={() => void saveWorkspace()}>
                  Save
                </button>
                <button
                  disabled={lock || !signedIn || !saved.some((row) => row.id === current.id)}
                  onClick={() => void saveWorkspace(current, true)}
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
                  Customize with Architect
                </button>
              </>
            )}
            {selected && (
              <button
                type="button"
                className="health-mobile-inspect"
                onClick={() => setInspect(true)}
              >
                Inspect
              </button>
            )}
          </div>
        </div>
        {data.mode === 'signed-out' && (
          <div className="health-notice" role="status">
            <p>
              Sign in to keep this workspace. Foundations still open as a labelled sample or local
              draft.
            </p>
            <Link href="/enter">Sign in</Link>
          </div>
        )}
        {recovery}
        <section
          className="health-surface"
          ref={surface}
          tabIndex={-1}
          aria-label="Active Health tool"
        >
          {architect && current ? (
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
              onAttempt={(attempt: ArchitectAttempt) =>
                replace({
                  ...current,
                  architect: attempt,
                  workingRevision: attempt.workingRevision,
                  lastWorkingRevision: current.lastWorkingRevision,
                })
              }
              onClose={() => setArchitect(false)}
            />
          ) : current?.foundation === 'evening-routine' && current.progress ? (
            <RoutineTool
              progress={current.progress}
              selected={selected}
              blocked={lock}
              onChange={(progress: RoutineProgress) => replace({ ...current, progress })}
              onSelect={setSelected}
            />
          ) : current?.foundation === 'bloodwork-tracker' ? (
            <BloodworkTool
              observations={data.observations}
              records={data.records}
              settings={current.settings.bloodwork ?? defaultBloodworkSettings()}
              sample={current.sample}
              selected={selected}
              blocked={lock}
              onSettings={(bloodwork) =>
                replace({ ...current, settings: { ...current.settings, bloodwork } })
              }
              onSelect={setSelected}
            />
          ) : (
            <div className="health-empty-surface">
              <h2>Start with something useful.</h2>
              <p>{foundationLibrary[0]!.prompt}</p>
              <button type="button" onClick={() => openFoundation('evening-routine')}>
                Open evening sequence
              </button>
              <button
                type="button"
                onClick={() => openFoundation('bloodwork-tracker', sampleBloodwork)}
              >
                Open Bloodwork Tracker
              </button>
            </div>
          )}
        </section>
        <form
          className="health-dock"
          onSubmit={(e) => {
            e.preventDefault();
            applyAssist(assist);
            setAssist('');
          }}
        >
          <label>
            Assist this surface
            <input
              value={assist}
              maxLength={300}
              placeholder="Change to ten minutes, or open bloodwork"
              onChange={(e) => setAssist(e.target.value)}
            />
          </label>
          <button type="submit">Apply</button>
          {assistNote && <p role="status">{assistNote}</p>}
        </form>
      </div>
      <aside className="health-inspector" aria-label="Selection inspector">
        {inspector ? (
          <>
            <p className="health-kicker">Inspector</p>
            <h2>{inspector.title}</h2>
            <p>{inspector.body}</p>
            <p className="health-footnote">{inspector.source}</p>
          </>
        ) : (
          <>
            <p className="health-kicker">Inspector</p>
            <p>
              Select a step, marker or constraint to see settings, sources and allowed behavior.
            </p>
            <p className="health-footnote">
              Architect Apps {ARCHITECT_APPS_DEPENDENCY.commit.slice(0, 7)} remains unmerged.
              Trusted controls still work.
            </p>
          </>
        )}
      </aside>
      <ContextSheet open={inspect} title="Inspector" onClose={() => setInspect(false)}>
        {inspector ? (
          <div className="health-dialog">
            <h3>{inspector.title}</h3>
            <p>{inspector.body}</p>
            <p>{inspector.source}</p>
          </div>
        ) : (
          <p>Nothing is selected.</p>
        )}
      </ContextSheet>
    </div>
  );
}

function inspectorCopy(workspace: HealthWorkspaceRecord, selected: SelectedElement) {
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
