'use client';
import { track } from '@/domains/onboarding/track';
import Link from 'next/link';
import { ContextSheet } from '@/components/interaction/context-sheet';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  defaultProfile,
  goalLabels,
  nextAdjustment,
  startSession,
  starterPlan,
  todayDirection,
  weeklyReview,
} from '@/domains/performance/model';
import {
  mutationSchema,
  sessionSchema,
  type Checkin,
  type Mutation,
  type PerformanceData,
  type Plan,
  type Session,
} from '@/domains/performance/schema';
import {
  beginDraft,
  forgetDraft,
  isolateOwner,
  readDraft,
  syncDraft,
  writeDraft,
  type DeviceDraft,
} from '../../../public/performance-store.js';
import { ProfileEditor, PlanEditor, CheckinEditor } from './editors';
import { MovementSpace } from './movement';
import { RecoverySpace } from './recovery';
import { FuelSpace } from './fuel';
import { Training } from './training';
import { FreestyleComposer } from './freestyle-composer';
import { ProgressionReview } from './progression';
import { ProgramEditor, ProgramCycle, SessionPreparation, SessionDecision } from './program';
import { createProgram, nextProgramSlot, startProgramSession } from '@/domains/performance/program';
import type { Prescription, Program } from '@/domains/performance/schema';
type View = 'today' | 'train' | 'restore' | 'fuel' | 'movement' | 'review';
export function PerformanceWorkspace({ initial }: { initial: PerformanceData }) {
  const [data, setData] = useState(initial);
  const [view, setView] = useState<View>('today');
  const [editing, setEditorValue] = useState<'profile' | 'plan' | 'checkin' | 'program' | null>(
    null,
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  function setEditing(next: 'profile' | 'plan' | 'checkin' | 'program' | null) {
    setEditorValue(next);
    setSheetOpen(next !== null);
  }
  const [programDraft, setProgramDraft] = useState<Program | null>(null);
  const [planDraft, setPlanDraft] = useState<Plan | null>(null);
  const [device, setDevice] = useState<DeviceDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [savingSet, setSavingSet] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [syncState, setSyncState] = useState('');
  const [conflict, setConflict] = useState(false);
  const [explanation, setExplanation] = useState('');
  const editLock = useRef(false);
  const mutationLock = useRef(false);
  const deviceRef = useRef<DeviceDraft | null>(null);
  const currentOwner = useRef(data.owner);
  const owner = data.owner;
  const personal = data.mode === 'personal';
  const profile = data.profile?.data ?? defaultProfile;
  const plan = data.plan;
  const today = data.checkins.find((c) => c.data.day === data.today);
  const direction = todayDirection(data);
  const weekly = weeklyReview(data);
  const adjustment = nextAdjustment(data);
  function setLocal(row: DeviceDraft | null) {
    const current = deviceRef.current;
    if (
      row &&
      current &&
      row.owner === current.owner &&
      (row.savedAt < current.savedAt ||
        (row.draft.id === current.draft.id &&
          (row.revision < current.revision || row.baseVersion < current.baseVersion)))
    )
      return;
    deviceRef.current = row;
    setDevice(row);
  }
  const reload = useCallback(async () => {
    const response = await fetch('/api/performance', {
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error || 'Records could not be loaded.');
    if (currentOwner.current && value.owner !== currentOwner.current)
      throw new Error('Account changed. Reopen Performance before continuing.');
    setData(value as PerformanceData);
    return value as PerformanceData;
  }, []);
  const sync = useCallback(async () => {
    if (!owner || !navigator.onLine) return;
    try {
      setSyncState('Syncing your workout…');
      const result = await syncDraft(owner);
      if (currentOwner.current !== owner) return;
      setLocal(result);
      setConflict(false);
      setSyncState(
        result && result.revision !== result.syncedRevision
          ? 'Saved on device · sync pending'
          : 'Synced to your account',
      );
      if (result?.draft.status === 'complete' && result.revision === result.syncedRevision) track('first_meaningful_action');
      if (result?.draft.status !== 'active') await reload();
    } catch (caught) {
      setSyncState(
        caught instanceof Error ? caught.message : 'Saved on this device. Reconnect to sync.',
      );
      if ((caught as { status?: number }).status === 409) setConflict(true);
    }
  }, [owner, reload]);
  useEffect(() => {
    currentOwner.current = owner;
    if (!owner) return;
    let live = true;
    void isolateOwner(owner)
      .then(() => readDraft(owner))
      .then((row) => {
        if (live) {
          setLocal(row);
          if (row && row.revision !== row.syncedRevision) void sync();
        }
      })
      .catch(() => {
        if (live)
          setError(
            'Device storage is unavailable. Training needs device storage to protect your sets.',
          );
      });
    const online = () => void sync();
    window.addEventListener('online', online);
    return () => {
      live = false;
      window.removeEventListener('online', online);
    };
  }, [owner, sync]);
  async function mutate(command: Mutation): Promise<boolean> {
    if (mutationLock.current) return false;
    mutationLock.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const parsed = mutationSchema.safeParse(command);
      if (!parsed.success)
        throw new Error(parsed.error.issues[0]?.message || 'Check your entries.');
      const response = await fetch('/api/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
        signal: AbortSignal.timeout(command.kind === 'review' ? 25000 : 15000),
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || 'The save could not be confirmed.');
      if (command.kind === 'review') setExplanation(value.text);
      else {
        await reload();
        setEditing(null);
        setNotice(
          command.kind === 'adapt' || command.kind === 'progress'
            ? 'Plan updated after your approval. The next workout will use the new target.'
            : 'Saved to your account.',
        );
      }
      return true;
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'The request could not complete. Your entries remain here.',
      );
      return false;
    } finally {
      mutationLock.current = false;
      setBusy(false);
    }
  }
  async function begin(prescription?: Prescription) {
    if (
      !owner ||
      (!plan && !prescription && !data.sessions.some((s) => s.data.status === 'active')) ||
      editLock.current
    )
      return;
    editLock.current = true;
    setError('');
    try {
      const existing = await readDraft(owner);
      if (
        existing &&
        (existing.draft.status === 'active' || existing.revision !== existing.syncedRevision)
      ) {
        setLocal(existing);
        setView('train');
        return;
      }
      const remote = data.sessions.find((s) => s.data.status === 'active');
      const row = await beginDraft(
        owner,
        remote?.data ??
          (prescription
            ? startProgramSession(prescription)
            : startSession(plan!.data, plan!.version, plan!.data.unit)),
        remote?.version ?? 0,
      );
      setLocal(row);
      setView('train');
      setSyncState('Saved on this device');
      void sync();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not start the workout.');
    } finally {
      editLock.current = false;
    }
  }
  async function beginFreestyle(freestyle: Plan) {
    if (!owner || editLock.current) return;
    editLock.current = true;
    setError('');
    try {
      const parsedPlan = freestyle;
      const existing = await readDraft(owner);
      if (
        existing &&
        (existing.draft.status === 'active' || existing.revision !== existing.syncedRevision)
      ) {
        setLocal(existing);
        setView('train');
        return;
      }
      const row = await beginDraft(
        owner,
        startSession(parsedPlan, 1, parsedPlan.unit),
        0,
      );
      setLocal(row);
      setView('train');
      setSyncState('Freestyle workout saved on this device');
      void sync();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not start the freestyle workout.');
    } finally {
      editLock.current = false;
    }
  }

  async function saveSession(value: Session): Promise<boolean> {
    if (!owner || !deviceRef.current || editLock.current || conflict) return false;
    editLock.current = true;
    setSavingSet(true);
    setError('');
    try {
      const parsed = sessionSchema.safeParse(value);
      if (!parsed.success) throw new Error('Enter valid reps and load before recording the set.');
      const row = await writeDraft(owner, parsed.data, deviceRef.current.revision);
      setLocal(row);
      setSyncState('Saved on this device');
      void sync();
      return true;
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'This set was not saved. Keep the page open and retry.',
      );
      return false;
    } finally {
      editLock.current = false;
      setSavingSet(false);
    }
  }
  function editProgram() {
    setProgramDraft(data.program?.data ?? createProgram(plan?.data ?? starterPlan(profile)));
    setEditing('program');
  }
  function editPlan() {
    setPlanDraft(plan?.data ?? starterPlan(profile));
    setEditing('plan');
  }
  async function refreshDraft() {
    if (!owner) return;
    try {
      setLocal(await readDraft(owner));
      setError('');
    } catch {
      setError('The device draft could not be loaded.');
    }
  }
  function exportRecords() {
    const blob = new Blob(
      [
        JSON.stringify(
          { exportedAt: new Date().toISOString(), records: data, deviceWorkout: deviceRef.current },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ascend-performance.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const blankCheck: Checkin = {
    day: data.today,
    sleepMinutes: null,
    energy: null,
    soreness: null,
    weight: null,
    unit: profile.unit,
    calories: null,
    protein: null,
    waterMl: null,
    nutritionComplete: false,
  };
  return (
    <div className="performance-world" data-view={view}>
      <header className="perf-header">
        <Link href="/app/world" className="perf-back">
          ← My world
        </Link>
        <span className="eyebrow">GENT ASCEND COLLECTIVE</span>
        <span className="perf-edition">PERFORMANCE / 01</span>
      </header>
      <div className="perf-title">
        <p className="eyebrow">THE PHYSICAL PRACTICE</p>
        <h1>
          Ascend <em>Performance.</em>
        </h1>
        <p>Train with intention. Build with evidence.</p>
      </div>
      <nav className="perf-nav" aria-label="Performance spaces">
        {(
          [
            ['today', 'Today'],
            ['train', 'Training'],
            ['restore', 'Restore'],
            ['fuel', 'Fuel & Body'],
            ['movement', 'Movement'],
            ['review', 'Review'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            aria-pressed={view === key}
            onClick={() => {
              setView(key);
              setEditing(null);
            }}
          >
            {label}
            <span aria-hidden="true">↗</span>
          </button>
        ))}
      </nav>
      {!personal && (
        <div className="perf-entry">
          <p className="eyebrow">YOUR PRIVATE PERFORMANCE SPACE</p>
          <h2>Begin with your own direction.</h2>
          <p>
            Connect your Gent Ascend account to build a plan, record your training, and develop a
            clearer picture over time.
          </p>
          <Link className="perf-primary" href="/app/you">
            Connect your account →
          </Link>
        </div>
      )}
      <div role="status" className="perf-notice">
        {notice}
      </div>
      {error && (
        <div role="alert" className="perf-error">
          <p>{error}</p>
          <button
            onClick={() =>
              void reload()
                .then(() => {
                  setEditing(null);
                  setError('');
                  setNotice('Loaded your saved records.');
                })
                .catch((e) => setError(e.message))
            }
          >
            Reload saved records
          </button>
          {device && <button onClick={() => void refreshDraft()}>Reload device draft</button>}
        </div>
      )}
      {personal && (
        <>
          {view === 'today' && (
            <>
              <ProgramCycle data={data} />
              <section className="perf-stage">
                <div className="perf-orbits" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <span>ASCEND</span>
                </div>
                <div className="perf-stage-copy">
                  <p className="eyebrow">TODAY / {data.today}</p>
                  <h2>{direction.title}</h2>
                  <p>{direction.text}</p>
                  <div className="perf-inline">
                    {!data.profile ? (
                      <button className="perf-primary" onClick={() => setEditing('profile')}>
                        Set your direction →
                      </button>
                    ) : !plan && !data.program ? (
                      <button className="perf-primary" onClick={editPlan}>
                        Shape your training plan →
                      </button>
                    ) : (
                      <button className="perf-primary" onClick={() => setView('train')}>
                        {device?.draft.status === 'active'
                          ? 'Resume your workout'
                          : 'Enter training'}{' '}
                        →
                      </button>
                    )}
                    <button onClick={() => setEditing('checkin')}>
                      {today ? 'Update check-in' : 'Check in'}
                    </button>
                  </div>
                </div>
                <div className="perf-stage-foot">
                  <span>
                    {data.profile ? goalLabels[profile.goal] : 'Your direction starts here'}
                  </span>
                  <span>
                    {data.profile
                      ? `${profile.daysPerWeek} sessions / week · ${profile.minutes} min available`
                      : 'PERSONAL / BUILT OVER TIME'}
                  </span>
                </div>
              </section>
              <section className="perf-week">
                <div>
                  <span className="eyebrow">LAST SEVEN DAYS</span>
                  <h3>Your effort, recorded.</h3>
                </div>
                <div>
                  <strong>{weekly.sessions}</strong>
                  <span>sessions completed</span>
                </div>
                <div>
                  <strong>{weekly.sets}</strong>
                  <span>sets recorded</span>
                </div>
                <div>
                  <strong>{weekly.checkins}</strong>
                  <span>daily check-ins</span>
                </div>
              </section>
              <div className="perf-inline">
                <button onClick={() => setEditing('profile')}>Edit direction</button>
                {data.profile && (
                  <button onClick={data.program ? editProgram : editPlan}>
                    {data.program ? 'Edit current program' : 'Edit training plan'}
                  </button>
                )}
              </div>
            </>
          )}
          {view === 'train' && (
            <>
              {device ? (
                <>
                  <div className="perf-sync">
                    <span role="status">{syncState || 'Workout saved on this device'}</span>
                    <button onClick={() => void sync()}>Sync now</button>
                  </div>
                  {conflict && (
                    <div className="perf-error" role="alert">
                      <h3>Another version is saved to your account.</h3>
                      <p>
                        Your device draft is retained. Export it before replacing it with the saved
                        account version.
                      </p>
                      <div className="perf-inline">
                        <button onClick={exportRecords}>Export both versions</button>
                        <button
                          onClick={async () => {
                            if (
                              !owner ||
                              !confirm(
                                'Discard this device draft and use the saved account version?',
                              )
                            )
                              return;
                            const fresh = await reload().catch(() => null);
                            if (!fresh) return;
                            await forgetDraft(owner);
                            setLocal(null);
                            const saved = fresh.sessions.find((s) => s.data.id === device.draft.id);
                            setLocal(
                              saved ? await beginDraft(owner, saved.data, saved.version) : null,
                            );
                            setConflict(false);
                            setSyncState('Loaded account version.');
                          }}
                        >
                          Use account version
                        </button>
                      </div>
                    </div>
                  )}
                  {device.draft.prescription && (
                    <SessionDecision prescription={device.draft.prescription} />
                  )}
                  <Training
                    key={device.draft.id}
                    session={device.draft}
                    plan={device.draft.prescription?.plan ?? plan?.data ?? null}
                    busy={savingSet || conflict}
                    save={saveSession}
                    history={data.sessions.map((entry) => entry.data)}
                  />
                  {device.draft.status !== 'active' &&
                    device.revision === device.syncedRevision && (
                      <button
                        className="perf-primary"
                        onClick={() => {
                          if (data.program) {
                            setLocal(null);
                            setView('train');
                          } else void begin();
                        }}
                      >
                        Prepare next session
                      </button>
                    )}
                  <p className="perf-caption">
                    Device copy retained for offline access.{' '}
                    <a href="/performance-offline.html">Open offline training</a>
                  </p>
                </>
              ) : data.sessions.some((s) => s.data.status === 'active') ? (
                <section className="perf-training-intro">
                  <h2>Your workout is waiting.</h2>
                  <p>
                    Resume the active account session with its original targets. Keeping it on this
                    device enables offline use.
                  </p>
                  <button className="perf-primary" onClick={() => void begin()}>
                    Resume & keep workout on device
                  </button>
                </section>
              ) : (
                <section className="perf-training-entry">
                  <FreestyleComposer
                    history={data.sessions.map((entry) => entry.data)}
                    unit={profile.unit}
                    busy={busy}
                    onStart={beginFreestyle}
                  />
                  <details className="perf-saved-structure">
                    <summary>
                      <span>
                        <span className="eyebrow">SAVED STRUCTURE</span>
                        <strong>Use a plan or repeating program instead</strong>
                      </span>
                      <span>＋</span>
                    </summary>
                    {data.program ? (
                      <SessionPreparation
                        key={`${data.program.version}-${data.program.nextSlotId}`}
                        data={data}
                        busy={busy}
                        start={(p) => void begin(p)}
                        edit={editProgram}
                        recover={() => {
                          setView('restore');
                          setNotice('Recovery today. Your next session will be waiting.');
                        }}
                      />
                    ) : (
                      <section className="perf-training-intro">
                        <p className="eyebrow">YOUR SAVED SESSION</p>
                        <h2>{plan?.data.title ?? 'Build a session worth repeating.'}</h2>
                        {plan ? (
                          <>
                            <ol className="perf-movements">
                              {plan.data.exercises.map((e) => (
                                <li key={e.id}>
                                  <span>{e.name}</span>
                                  <strong>
                                    {e.sets} × {e.reps}
                                    <small>
                                      {e.load} {plan.data.unit}
                                    </small>
                                  </strong>
                                </li>
                              ))}
                            </ol>
                            <div className="perf-inline">
                              <button className="perf-primary" onClick={() => void begin()}>
                                Start saved workout →
                              </button>
                              <button onClick={editPlan}>Edit plan</button>
                            </div>
                          </>
                        ) : (
                          <button
                            className="perf-primary"
                            onClick={() => (data.profile ? editPlan() : setEditing('profile'))}
                          >
                            {data.profile ? 'Create a reusable plan' : 'Set your direction'}
                          </button>
                        )}
                      </section>
                    )}
                  </details>
                </section>
              )}
            </>
          )}
          {view === 'movement' && <MovementSpace data={data} busy={busy} save={mutate} />}
          {view === 'fuel' && <FuelSpace data={data} busy={busy} error={error} save={mutate} />}
          {view === 'restore' && (
            <RecoverySpace data={data} busy={busy} error={error} save={mutate} />
          )}
          {view === 'review' && (
            <section className="perf-review">
              <p className="eyebrow">THE LEARNING LOOP / LAST SEVEN DAYS</p>
              <h2>What carries forward.</h2>
              <p>
                {weekly.sessions} completed sessions. {weekly.sets} recorded sets.{' '}
                {weekly.sleepDays
                  ? `Average reported sleep: ${(weekly.sleepMinutes! / 60).toFixed(1)} hours across ${weekly.sleepDays} days.`
                  : 'Sleep history is still forming.'}
              </p>
              {data.program ? (
                <ProgressionReview
                  data={data}
                  busy={busy}
                  deviceActive={
                    !!device &&
                    (device.draft.status === 'active' || device.revision !== device.syncedRevision)
                  }
                  onAccept={(input) => void mutate(input)}
                />
              ) : (
                <div className="perf-insight">
                  <span className="eyebrow">NEXT SESSION / RULE-BASED PROPOSAL</span>
                  {adjustment ? (
                    <>
                      <h3>
                        {adjustment.exercise}: try {adjustment.to} reps.
                      </h3>
                      <p>{adjustment.reason}</p>
                      <p className="perf-caption">
                        Sources: your two latest completed workouts. This is a modest trial, not a
                        forecast. Only this exercise’s rep target changes.
                      </p>
                      <button
                        className="perf-primary"
                        disabled={busy}
                        onClick={() =>
                          void mutate({
                            kind: 'adapt',
                            requestId: crypto.randomUUID(),
                            expectedVersion: plan!.version,
                            sourceIds: adjustment.sourceIds,
                          })
                        }
                      >
                        Approve {adjustment.from} → {adjustment.to} reps
                      </button>
                    </>
                  ) : (
                    <>
                      <h3>
                        {data.program
                          ? 'Review the pattern. Choose the next change.'
                          : 'Keep learning before changing the target.'}
                      </h3>
                      <p>
                        {data.program
                          ? 'Your program keeps the targets you reviewed. Compare the original, accepted and completed work below; edit the program when you decide a change is appropriate. Automatic program progression is not active.'
                          : 'A progression proposal needs two recent sessions on this plan, all planned sets completed at the target load, and effort of 7/10 or lower. Recorded limitations, discomfort, or a demanding daily check-in pause proposals.'}
                      </p>
                      {data.program && (
                        <button onClick={editProgram}>Review program targets</button>
                      )}
                    </>
                  )}
                </div>
              )}
              <div className="perf-aethelios">
                <span className="eyebrow">AETHELIOS / INTERPRET YOUR RECORDS</span>
                <h3>Put the week into perspective.</h3>
                <p className="perf-caption">
                  Share your Performance goal, limitations, seven recent check-ins, three recent
                  sessions, their accepted adjustments, program title, session progression evidence,
                  recorded outcomes after approved changes, your fuel references, 28-day weight
                  readings, seven-day intake and recovery summaries, and up to seven recovery
                  practices with Aethelios for this request. This does not add them to memory.
                </p>
                <button
                  disabled={busy || !data.profile}
                  onClick={() => void mutate({ kind: 'review', requestId: crypto.randomUUID() })}
                >
                  {busy ? 'Preparing review…' : 'Ask Aethelios to review'}
                </button>
                {explanation && (
                  <div className="perf-explanation">
                    <p>{explanation}</p>
                    <span className="perf-caption">AI interpretation · no plan changes made</span>
                  </div>
                )}
              </div>
              <h3>Recorded sessions</h3>
              {data.sessions.length ? (
                data.sessions.map((s) => (
                  <details className="perf-history" key={s.data.id}>
                    <summary>
                      {new Date(s.data.startedAt).toLocaleDateString('en-US', {
                        timeZone: data.timezone,
                        month: 'short',
                        day: 'numeric',
                      })}{' '}
                      · {s.data.title} · {s.data.status}
                    </summary>
                    <p>
                      {s.data.sets.filter((x) => x.done).length} recorded sets · {s.data.unit}
                    </p>
                    {s.data.sets
                      .filter((x) => x.done)
                      .map((x) => (
                        <p key={x.id}>
                          {x.exercise} · {x.reps} × {x.load} {s.data.unit}
                          {x.effort ? ` · effort ${x.effort}/10` : ''}
                        </p>
                      ))}
                    {s.data.prescription && <SessionDecision prescription={s.data.prescription} />}
                    {s.data.note && <p>{s.data.note}</p>}
                  </details>
                ))
              ) : (
                <p className="perf-caption">Your first completed session starts the record.</p>
              )}
              <details className="perf-history">
                <summary>Body & nutrition observations</summary>
                {data.checkins.length ? (
                  data.checkins.map((c) => (
                    <p key={c.data.day}>
                      {c.data.day} · Weight{' '}
                      {c.data.weight === null ? 'unrecorded' : `${c.data.weight} ${c.data.unit}`} ·
                      Calories {c.data.calories ?? 'unrecorded'} · Protein{' '}
                      {c.data.protein === null ? 'unrecorded' : `${c.data.protein} g`} · Water{' '}
                      {c.data.waterMl === null ? 'unrecorded' : `${c.data.waterMl} ml`} ·{' '}
                      {c.data.nutritionComplete ? 'Full day reported' : 'Partial or unknown intake'}
                    </p>
                  ))
                ) : (
                  <p>No observations yet.</p>
                )}
              </details>
              <div className="perf-inline">
                <button onClick={exportRecords}>Export loaded records & device draft</button>
              </div>
              <p className="perf-caption">
                Review includes the latest 60 sessions and 90 check-ins. Earlier account records are
                retained.
              </p>
            </section>
          )}
          {(view === 'today' || view === 'train') && !device && (
            <div className="perf-program-entry">
              <p className="eyebrow">THE NEXT CHAPTER</p>
              <h3>
                {data.program
                  ? `Next up: ${nextProgramSlot(data)?.plan.title}`
                  : 'Give every session its place.'}
              </h3>
              <p>
                {data.program
                  ? 'Your program moves forward when you complete its next session.'
                  : 'Turn your practice into a repeating program, with different sessions for different days.'}
              </p>
              <button onClick={editProgram}>
                {data.program ? 'Edit training program' : 'Build training program'}
              </button>
            </div>
          )}
          <ContextSheet
            open={sheetOpen}
            title={
              editing === 'checkin'
                ? 'Your check-in'
                : editing === 'profile'
                  ? 'Your direction'
                  : 'Your training plan'
            }
            busy={busy}
            onClose={() => setSheetOpen(false)}
          >
            {error && (
              <p role="alert" className="perf-error">
                {error}
              </p>
            )}
            {editing === 'program' && programDraft && (
              <ProgramEditor
                initial={programDraft}
                key={data.program?.version ?? 0}
                busy={busy}
                save={async (payload) => {
                  await mutate({
                    kind: 'program',
                    requestId: crypto.randomUUID(),
                    expectedVersion: data.program?.version ?? 0,
                    payload,
                  });
                }}
              />
            )}
            {editing === 'profile' && (
              <ProfileEditor
                close={() => setSheetOpen(false)}
                key={data.profile?.version ?? 0}
                initial={data.profile?.data ?? null}
                busy={busy}
                save={async (payload) => {
                  await mutate({
                    kind: 'profile',
                    requestId: crypto.randomUUID(),
                    expectedVersion: data.profile?.version ?? 0,
                    payload,
                  });
                }}
              />
            )}
            {editing === 'plan' && planDraft && (
              <PlanEditor
                key={plan?.version ?? 0}
                initial={planDraft}
                busy={busy}
                save={async (payload) => {
                  await mutate({
                    kind: 'plan',
                    requestId: crypto.randomUUID(),
                    expectedVersion: plan?.version ?? 0,
                    payload,
                  });
                }}
              />
            )}
            {editing === 'checkin' && (
              <CheckinEditor
                key={`${data.today}-${today?.version ?? 0}`}
                initial={today?.data ?? blankCheck}
                busy={busy}
                save={async (payload) => {
                  await mutate({
                    kind: 'checkin',
                    requestId: crypto.randomUUID(),
                    expectedVersion: today?.version ?? 0,
                    payload,
                  });
                }}
              />
            )}
            {editing && (
              <button className="perf-cancel" disabled={busy} onClick={() => setSheetOpen(false)}>
                Close editor
              </button>
            )}
          </ContextSheet>
        </>
      )}
      <footer className="perf-footer">
        <span>THE WHOLE MAN. A STRONGER PHYSICAL FOUNDATION.</span>
        <Link href="/app">Return to Command ↗</Link>
      </footer>
    </div>
  );
}
