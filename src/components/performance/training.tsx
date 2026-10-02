'use client';
import { useEffect, useMemo, useState } from 'react';
import type { Session, Plan } from '@/domains/performance/schema';
import { MachineScout, type MachineScoutResult } from './machine-scout';

function SetEntry({
  set,
  index,
  unit,
  disabled,
  save,
}: {
  set: Session['sets'][number];
  index: number;
  unit: string;
  disabled: boolean;
  save: (set: Session['sets'][number]) => Promise<void>;
}) {
  const [value, setValue] = useState(set);
  return (
    <div className="perf-set" data-done={set.done}>
      <span className="perf-set-index">{String(index + 1).padStart(2, '0')}</span>
      <div className="perf-set-inputs">
        <label>
          Reps
          <input
            aria-label={`Set ${index + 1} reps`}
            inputMode="numeric"
            type="number"
            min="1"
            max="100"
            step="1"
            value={value.reps ?? ''}
            disabled={disabled || set.done}
            onChange={(e) =>
              setValue({ ...value, reps: e.target.value === '' ? null : e.target.valueAsNumber })
            }
          />
        </label>
        <label>
          {unit}
          <input
            aria-label={`Set ${index + 1} load`}
            inputMode="decimal"
            type="number"
            min="0"
            max="1500"
            step="0.5"
            value={value.load ?? ''}
            disabled={disabled || set.done}
            onChange={(e) =>
              setValue({ ...value, load: e.target.value === '' ? null : e.target.valueAsNumber })
            }
          />
        </label>
        <label>
          Effort
          <input
            aria-label={`Set ${index + 1} effort`}
            inputMode="numeric"
            type="number"
            min="1"
            max="10"
            step="1"
            placeholder="—"
            value={value.effort ?? ''}
            disabled={disabled || set.done}
            onChange={(e) =>
              setValue({ ...value, effort: e.target.value === '' ? null : e.target.valueAsNumber })
            }
          />
        </label>
      </div>
      <button
        className={set.done ? 'perf-set-recorded' : 'perf-set-record'}
        disabled={disabled}
        aria-label={`${set.done ? 'Undo' : 'Record'} set ${index + 1}`}
        onClick={() => void save({ ...value, done: !set.done })}
      >
        {set.done ? '✓ Recorded' : 'Record set'}
      </button>
    </div>
  );
}

export function Training({
  session,
  plan,
  busy,
  save,
  history = [],
}: {
  session: Session;
  plan: Plan | null;
  busy: boolean;
  save: (value: Session) => Promise<boolean>;
  history?: Session[];
}) {
  const [note, setNote] = useState(session.note);
  const [restUntil, setRestUntil] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [manualName, setManualName] = useState('');
  const [manualSets, setManualSets] = useState(3);
  const [manualReps, setManualReps] = useState(10);
  const exerciseIds = useMemo(
    () => Array.from(new Set(session.sets.map((s) => s.exerciseId))),
    [session.sets],
  );
  const firstIncomplete =
    exerciseIds.find((id) => session.sets.some((set) => set.exerciseId === id && !set.done)) ??
    exerciseIds[0]!;
  const [activeExercise, setActiveExercise] = useState(firstIncomplete);

  useEffect(() => {
    if (!exerciseIds.includes(activeExercise)) setActiveExercise(firstIncomplete);
  }, [activeExercise, exerciseIds, firstIncomplete]);

  useEffect(() => {
    if (!restUntil) return;
    const tick = () => {
      const next = Math.max(0, Math.ceil((restUntil - Date.now()) / 1000));
      setRemaining(next);
      if (next === 0) setRestUntil(null);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [restUntil]);

  const complete = session.sets.filter((s) => s.done).length;
  const percent = Math.round((complete / session.sets.length) * 100);
  const activeIndex = Math.max(0, exerciseIds.indexOf(activeExercise));
  const activeSets = session.sets.filter((set) => set.exerciseId === activeExercise);
  const activeName = activeSets[0]?.exercise ?? session.title;
  const activeTarget = activeSets[0]?.targetReps ?? 0;
  const exerciseComplete = activeSets.filter((set) => set.done).length;
  const sessionActive = session.status === 'active';
  const normalizedActiveName = activeName.trim().toLowerCase();
  const previousSet = history
    .filter((past) => past.id !== session.id)
    .flatMap((past) => past.sets)
    .filter((set) => set.done && set.exercise.trim().toLowerCase() === normalizedActiveName)
    .sort((a, b) => (b.load ?? 0) - (a.load ?? 0))[0] ?? null;
  const lastCompleted = [...activeSets].reverse().find((set) => set.done) ?? null;
  const nextOpen = activeSets.find((set) => !set.done) ?? null;
  const liveCue = session.pain
    ? 'Discomfort is logged. Do not chase progression here; choose the next set deliberately.'
    : !lastCompleted
      ? previousSet
        ? `Your history is here. Start where today feels appropriate, then let the next set respond to the record.`
        : 'First signal: record the set honestly. Effort is what turns logging into learning.'
      : lastCompleted.effort == null
        ? 'Log effort on the next set if you can. That signal makes adaptation more useful.'
        : lastCompleted.effort >= 9
          ? 'That set was near your reported limit. Holding the target is the conservative move.'
          : lastCompleted.effort <= 6 && lastCompleted.reps != null && lastCompleted.reps >= lastCompleted.targetReps
            ? 'You reported room left. If the rep quality felt solid, one more rep on the next set is a reasonable experiment.'
            : 'You are in the working zone. Hold the target and build another clean data point.';

  async function addMovement(name: string, sets = 3, reps = 10) {
    const clean = name.trim().slice(0, 70);
    if (!clean || sets < 1 || sets > 8 || reps < 1 || reps > 30) return;
    const exerciseId = crypto.randomUUID();
    const nextSets: Session['sets'] = Array.from({ length: sets }, () => ({
      id: crypto.randomUUID(),
      exerciseId,
      exercise: clean,
      targetReps: reps,
      targetLoad: 0,
      reps: null,
      load: null,
      effort: null,
      done: false,
    }));
    const saved = await save({ ...session, sets: [...session.sets, ...nextSets] });
    if (saved) {
      setActiveExercise(exerciseId);
      setManualName('');
    }
  }

  async function addScoutedMovement(result: MachineScoutResult) {
    await addMovement(result.name, 3, 10);
  }

  function moveExercise(direction: -1 | 1) {
    const next = Math.min(exerciseIds.length - 1, Math.max(0, activeIndex + direction));
    setActiveExercise(exerciseIds[next]!);
    document.getElementById('active-exercise')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <section className="perf-training perf-training-mode">
      <div className="perf-training-hud">
        <div className="perf-training-status">
          <span className="eyebrow">LIVE SESSION</span>
          <strong>{percent}%</strong>
          <span>{complete}/{session.sets.length} sets</span>
        </div>
        <div
          className="perf-training-progress"
          role="progressbar"
          aria-label="Workout progress"
          aria-valuemin={0}
          aria-valuemax={session.sets.length}
          aria-valuenow={complete}
        >
          <i style={{ width: `${percent}%` }} />
        </div>
        <div className="perf-rest" aria-live="polite">
          <span>REST</span>
          <strong>
            {remaining
              ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`
              : 'READY'}
          </strong>
          {remaining > 0 && (
            <button
              onClick={() => {
                setRestUntil(null);
                setRemaining(0);
              }}
            >
              Skip
            </button>
          )}
        </div>
      </div>

      <header className="perf-training-heading">
        <div>
          <p className="eyebrow">TRAINING / {session.unit.toUpperCase()}</p>
          <h2>{session.title}</h2>
          <p>One movement at a time. Your full session stays saved on this device.</p>
        </div>
      </header>

      {sessionActive && (
        <details className="perf-live-builder">
          <summary>
            <span>
              <span className="eyebrow">BUILD AS YOU GO</span>
              <strong>Add what you find in the gym</strong>
            </span>
            <span>＋</span>
          </summary>
          <div className="perf-live-builder-body">
            <MachineScout disabled={busy} onAdd={addScoutedMovement} />
            <form
              className="perf-quick-add"
              onSubmit={(event) => {
                event.preventDefault();
                void addMovement(manualName, manualSets, manualReps);
              }}
            >
              <span className="eyebrow">QUICK ADD</span>
              <label>
                Movement
                <input
                  value={manualName}
                  maxLength={70}
                  placeholder="Incline press machine"
                  onChange={(event) => setManualName(event.target.value)}
                />
              </label>
              <div>
                <label>
                  Sets
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={8}
                    value={manualSets}
                    onChange={(event) => setManualSets(event.target.valueAsNumber || 1)}
                  />
                </label>
                <label>
                  Rep target
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={30}
                    value={manualReps}
                    onChange={(event) => setManualReps(event.target.valueAsNumber || 1)}
                  />
                </label>
              </div>
              <button className="perf-primary" disabled={busy || !manualName.trim()}>
                Add movement →
              </button>
            </form>
          </div>
        </details>
      )}

      <nav className="perf-exercise-rail" aria-label="Workout exercises">
        {exerciseIds.map((id, index) => {
          const sets = session.sets.filter((set) => set.exerciseId === id);
          const done = sets.filter((set) => set.done).length;
          const name = sets[0]?.exercise ?? `Exercise ${index + 1}`;
          return (
            <button
              key={id}
              type="button"
              aria-current={id === activeExercise ? 'step' : undefined}
              data-complete={done === sets.length}
              onClick={() => setActiveExercise(id)}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{name}</strong>
              <small>{done}/{sets.length}</small>
            </button>
          );
        })}
      </nav>

      <section className="perf-lift perf-lift-focus" id="active-exercise">
        <div className="perf-lift-heading">
          <div>
            <span className="eyebrow">
              MOVEMENT {activeIndex + 1} / {exerciseIds.length}
            </span>
            <h3>{activeName}</h3>
          </div>
          <div className="perf-lift-target">
            <strong>{activeTarget}</strong>
            <span>target reps</span>
          </div>
        </div>
        <div className="perf-lift-meta">
          <span>{exerciseComplete}/{activeSets.length} sets complete</span>
          <span>
            {plan?.exercises.find((exercise) => exercise.id === activeExercise)?.restSeconds ?? 90}s rest
          </span>
        </div>

        <aside className="perf-live-intelligence">
          <div>
            <span className="eyebrow">AETHELIOS / LIVE SIGNAL</span>
            <p>{liveCue}</p>
          </div>
          {previousSet && (
            <div className="perf-last-time">
              <span>LAST RECORDED</span>
              <strong>{previousSet.reps ?? '—'} reps · {previousSet.load ?? '—'} {session.unit}</strong>
              <small>{previousSet.effort ? `effort ${previousSet.effort}/10` : 'effort not recorded'}</small>
            </div>
          )}
          {lastCompleted?.effort != null &&
            lastCompleted.effort <= 6 &&
            lastCompleted.reps != null &&
            lastCompleted.reps >= lastCompleted.targetReps &&
            nextOpen && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void save({
                    ...session,
                    sets: session.sets.map((set) =>
                      set.id === nextOpen.id
                        ? { ...set, targetReps: Math.min(30, set.targetReps + 1) }
                        : set,
                    ),
                  })
                }
              >
                Try +1 rep next set
              </button>
            )}
        </aside>

        {activeSets.map((set, index) => (
          <SetEntry
            key={`${set.id}-${set.done}`}
            set={set}
            index={index}
            unit={session.unit}
            disabled={busy || !sessionActive}
            save={async (next) => {
              const nextSession = {
                ...session,
                sets: session.sets.map((current) => (current.id === set.id ? next : current)),
              };
              const saved = await save(nextSession);
              if (!saved || !next.done) return;

              const seconds =
                plan?.exercises.find((exercise) => exercise.id === activeExercise)?.restSeconds ?? 90;
              setRemaining(seconds);
              setRestUntil(Date.now() + seconds * 1000);

              const movementFinished = nextSession.sets
                .filter((current) => current.exerciseId === activeExercise)
                .every((current) => current.done);
              if (movementFinished && activeIndex < exerciseIds.length - 1) {
                setActiveExercise(exerciseIds[activeIndex + 1]!);
              }
            }}
          />
        ))}

        <div className="perf-exercise-controls">
          <button type="button" disabled={activeIndex === 0} onClick={() => moveExercise(-1)}>
            ← Previous
          </button>
          <button
            type="button"
            disabled={activeIndex === exerciseIds.length - 1}
            onClick={() => moveExercise(1)}
          >
            Next movement →
          </button>
        </div>
      </section>

      {sessionActive ? (
        <div className="perf-session-close">
          <details className="perf-session-details">
            <summary>Session notes & discomfort</summary>
            <label className="perf-check">
              <input
                type="checkbox"
                disabled={busy}
                checked={session.pain}
                onChange={(e) => void save({ ...session, pain: e.target.checked })}
              />
              I noticed pain or discomfort
            </label>
            <label>
              Session note
              <textarea
                key={session.id}
                value={note}
                maxLength={500}
                rows={2}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional. What should you remember next time?"
              />
            </label>
            <button disabled={busy || note === session.note} onClick={() => void save({ ...session, note })}>
              Save note
            </button>
          </details>

          <div className="perf-session-finish">
            <div>
              <span className="eyebrow">SESSION PROGRESS</span>
              <strong>{complete}/{session.sets.length} sets recorded</strong>
              <small>{session.sets.length - complete} sets still open</small>
            </div>
            <button
              className="perf-primary"
              disabled={busy || complete === 0}
              onClick={() =>
                void save({
                  ...session,
                  note,
                  status: 'complete',
                  endedAt: new Date().toISOString(),
                })
              }
            >
              Finish workout
            </button>
            <button
              className="perf-end-quiet"
              disabled={busy}
              onClick={() => {
                if (
                  confirm(
                    'End this session? Recorded sets will be retained as an unfinished session.',
                  )
                )
                  void save({
                    ...session,
                    note,
                    status: 'abandoned',
                    endedAt: new Date().toISOString(),
                  });
              }}
            >
              End without completing
            </button>
          </div>
        </div>
      ) : (
        <div className="perf-session-close perf-session-complete">
          <span className="eyebrow">SESSION CLOSED</span>
          <h3>{session.status === 'complete' ? 'Workout complete.' : 'Session ended.'}</h3>
          <p>Your recorded work is part of your Performance history and can inform the next review.</p>
        </div>
      )}
    </section>
  );
}
