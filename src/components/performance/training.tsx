'use client';
import { useEffect, useState } from 'react';
import type { Session, Plan } from '@/domains/performance/schema';
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
          Effort / 10
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
        disabled={disabled}
        aria-label={`${set.done ? 'Undo' : 'Record'} set ${index + 1}`}
        onClick={() => void save({ ...value, done: !set.done })}
      >
        {set.done ? '✓ Recorded' : 'Record'}
      </button>
    </div>
  );
}
export function Training({
  session,
  plan,
  busy,
  save,
}: {
  session: Session;
  plan: Plan | null;
  busy: boolean;
  save: (value: Session) => Promise<boolean>;
}) {
  const [note, setNote] = useState(session.note);
  const [restUntil, setRestUntil] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!restUntil) return;
    const tick = () => setRemaining(Math.max(0, Math.ceil((restUntil - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [restUntil]);
  const complete = session.sets.filter((s) => s.done).length;
  const groups = Array.from(new Set(session.sets.map((s) => s.exerciseId)));
  return (
    <section className="perf-training">
      <header className="perf-training-heading">
        <div>
          <p className="eyebrow">TRAINING / {session.unit.toUpperCase()}</p>
          <h2>{session.title}</h2>
          <p>
            {complete} of {session.sets.length} sets recorded
          </p>
        </div>
        <div className="perf-rest" aria-live="off">
          <span>REST TIMER</span>
          <strong>
            {remaining
              ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`
              : 'Ready'}
          </strong>
          {remaining > 0 && (
            <button
              onClick={() => {
                setRestUntil(null);
                setRemaining(0);
              }}
            >
              Clear timer
            </button>
          )}
        </div>
      </header>
      <p className="perf-caption">
        Adjust reps and load to what you actually did, then record the set. Effort is optional: 10
        means maximum effort.
      </p>
      {groups.map((id) => (
        <section className="perf-lift" key={id}>
          <div className="perf-lift-heading">
            <h3>{session.sets.find((s) => s.exerciseId === id)!.exercise}</h3>
            <span>Target · {session.sets.find((s) => s.exerciseId === id)!.targetReps} reps</span>
          </div>
          {session.sets.map((set, index) =>
            set.exerciseId === id ? (
              <SetEntry
                key={`${set.id}-${set.done}`}
                set={set}
                index={index}
                unit={session.unit}
                disabled={busy || session.status !== 'active'}
                save={async (next) => {
                  const saved = await save({
                    ...session,
                    sets: session.sets.map((s) => (s.id === set.id ? next : s)),
                  });
                  if (saved && next.done) {
                    const seconds = plan?.exercises.find((e) => e.id === id)?.restSeconds ?? 90;
                    setRemaining(seconds);
                    setRestUntil(Date.now() + seconds * 1000);
                  }
                }}
              />
            ) : null,
          )}
        </section>
      ))}
      {session.status === 'active' ? (
        <div className="perf-session-close">
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
          <button
            disabled={busy || note === session.note}
            onClick={() => void save({ ...session, note })}
          >
            Save note
          </button>
          <p className="perf-caption">
            {session.sets.length - complete} unrecorded sets will remain unrecorded when you finish.
          </p>
          <div className="perf-inline">
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
        <div className="perf-session-close">
          <h3>{session.status === 'complete' ? 'Session complete.' : 'Session ended.'}</h3>
          <p>Your recorded effort is now part of the picture. Sync to include it in your review.</p>
        </div>
      )}
    </section>
  );
}
