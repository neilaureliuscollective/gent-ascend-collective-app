'use client';

import { useMemo, useState } from 'react';
import type { Plan, Session } from '@/domains/performance/schema';
import { MachineScout, type MachineScoutResult } from './machine-scout';

type DraftMovement = Plan['exercises'][number];
type Intent = 'upper' | 'push' | 'pull' | 'legs' | 'full' | 'move';

const intentLabels: Record<Intent, string> = {
  upper: 'Upper body',
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
  full: 'Full body',
  move: 'Just get moving',
};

function cleanName(name: string) {
  return name.trim().replace(/\s+/g, ' ');
}

function movementFromHistory(session: Session) {
  const order: string[] = [];
  const grouped = new Map<string, Session['sets']>();
  for (const set of session.sets) {
    const key = set.exercise.trim().toLowerCase();
    if (!grouped.has(key)) {
      grouped.set(key, []);
      order.push(key);
    }
    grouped.get(key)!.push(set);
  }
  return order.map((key) => {
    const sets = grouped.get(key)!;
    const sample = sets[0]!;
    const completed = [...sets].reverse().find((set) => set.done) ?? sample;
    return {
      id: crypto.randomUUID(),
      name: sample.exercise,
      sets: Math.min(8, Math.max(1, sets.length)),
      reps: Math.min(30, Math.max(1, completed.reps ?? sample.targetReps)),
      load: Math.max(0, completed.load ?? sample.targetLoad),
      restSeconds: 90,
    } satisfies DraftMovement;
  });
}

export function FreestyleComposer({
  history,
  unit,
  busy,
  onStart,
}: {
  history: Session[];
  unit: 'kg' | 'lb';
  busy: boolean;
  onStart: (plan: Plan) => Promise<void>;
}) {
  const [intent, setIntent] = useState<Intent>('upper');
  const [title, setTitle] = useState('');
  const [draft, setDraft] = useState<DraftMovement[]>([]);
  const [manualName, setManualName] = useState('');
  const [manualSets, setManualSets] = useState(3);
  const [manualReps, setManualReps] = useState(10);
  const [starting, setStarting] = useState(false);

  const learned = useMemo(() => {
    const map = new Map<
      string,
      { name: string; appearances: number; last: Session['sets'][number]; latestAt: string }
    >();
    const completed = history
      .filter((session) => session.status === 'complete')
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    for (const session of completed) {
      const seen = new Set<string>();
      for (const set of session.sets) {
        const key = set.exercise.trim().toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const lastSet =
          [...session.sets]
            .reverse()
            .find((candidate) => candidate.done && candidate.exercise.trim().toLowerCase() === key) ??
          set;
        const existing = map.get(key);
        map.set(key, {
          name: set.exercise,
          appearances: (existing?.appearances ?? 0) + 1,
          last: existing?.last ?? lastSet,
          latestAt: existing?.latestAt ?? session.startedAt,
        });
      }
    }
    return [...map.values()]
      .sort((a, b) => b.appearances - a.appearances || b.latestAt.localeCompare(a.latestAt))
      .slice(0, 8);
  }, [history]);

  const lastWorkout = useMemo(
    () =>
      history
        .filter((session) => session.status === 'complete')
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] ?? null,
    [history],
  );

  function addMovement(name: string, sets = 3, reps = 10, load = 0) {
    const clean = cleanName(name).slice(0, 70);
    if (!clean) return;
    setDraft((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: clean,
        sets: Math.min(8, Math.max(1, sets)),
        reps: Math.min(30, Math.max(1, reps)),
        load: Math.min(1500, Math.max(0, load)),
        restSeconds: 90,
      },
    ]);
    setManualName('');
  }

  function addScouted(result: MachineScoutResult) {
    addMovement(result.name, 3, 10, 0);
    return Promise.resolve();
  }

  const sessionTitle = cleanName(title) || `${intentLabels[intent]} · freestyle`;

  return (
    <section className="perf-freestyle">
      <div className="perf-freestyle-hero">
        <div>
          <span className="eyebrow">FREESTYLE / TODAY ONLY</span>
          <h2>Build the workout while you train.</h2>
          <p>
            No program required. Choose the direction, add what feels right in the room, and let
            Performance learn from what you actually keep choosing.
          </p>
        </div>
        {lastWorkout && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setDraft(movementFromHistory(lastWorkout))}
          >
            Repeat last workout
          </button>
        )}
      </div>

      <div className="perf-intent-rail" role="group" aria-label="Today's training intent">
        {(Object.keys(intentLabels) as Intent[]).map((key) => (
          <button
            type="button"
            key={key}
            aria-pressed={intent === key}
            onClick={() => setIntent(key)}
          >
            {intentLabels[key]}
          </button>
        ))}
      </div>

      {learned.length > 0 && (
        <section className="perf-learned-movements">
          <div>
            <span className="eyebrow">LEARNED FROM YOU</span>
            <h3>Movements you keep coming back to.</h3>
          </div>
          <div className="perf-learned-rail">
            {learned.map((item) => (
              <button
                type="button"
                key={item.name.toLowerCase()}
                disabled={busy}
                onClick={() =>
                  addMovement(
                    item.name,
                    3,
                    item.last.reps ?? item.last.targetReps,
                    item.last.load ?? item.last.targetLoad,
                  )
                }
              >
                <strong>{item.name}</strong>
                <span>
                  {item.appearances} session{item.appearances === 1 ? '' : 's'}
                </span>
                <small>
                  last · {item.last.reps ?? item.last.targetReps} ×{' '}
                  {item.last.load ?? item.last.targetLoad} {unit}
                </small>
              </button>
            ))}
          </div>
        </section>
      )}

      <MachineScout disabled={busy} onAdd={addScouted} />

      <form
        className="perf-freestyle-manual"
        onSubmit={(event) => {
          event.preventDefault();
          addMovement(manualName, manualSets, manualReps);
        }}
      >
        <span className="eyebrow">OR ADD IT YOURSELF</span>
        <label>
          Movement
          <input
            value={manualName}
            maxLength={70}
            placeholder="Incline plate-loaded press"
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
          Add movement
        </button>
      </form>

      <section className="perf-session-composer">
        <div className="perf-session-composer-heading">
          <div>
            <span className="eyebrow">TODAY&apos;S SESSION</span>
            <h3>{sessionTitle}</h3>
          </div>
          <strong>{draft.length}</strong>
        </div>

        {draft.length === 0 ? (
          <p className="perf-caption">
            Add the first machine or movement. You can keep adding exercises after the workout starts.
          </p>
        ) : (
          <ol>
            {draft.map((movement, index) => (
              <li key={movement.id}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <strong>{movement.name}</strong>
                  <small>
                    {movement.sets} sets · {movement.reps} reps · {movement.load} {unit}
                  </small>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${movement.name}`}
                  onClick={() => setDraft((current) => current.filter((item) => item.id !== movement.id))}
                >
                  ×
                </button>
              </li>
            ))}
          </ol>
        )}

        <label className="perf-session-name">
          Session name <span>optional</span>
          <input
            value={title}
            maxLength={80}
            placeholder={sessionTitle}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>

        <button
          type="button"
          className="perf-primary perf-start-freestyle"
          disabled={busy || starting || draft.length === 0}
          onClick={async () => {
            setStarting(true);
            try {
              await onStart({ title: sessionTitle, unit, exercises: draft });
            } finally {
              setStarting(false);
            }
          }}
        >
          {starting ? 'Opening training…' : 'Start this workout →'}
        </button>
      </section>
    </section>
  );
}
