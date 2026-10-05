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
  move: 'Just move',
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
  handoffText = '',
  preparedPlan = null,
}: {
  history: Session[];
  unit: 'kg' | 'lb';
  busy: boolean;
  handoffText?: string;
  preparedPlan?: Plan | null;
  onStart: (plan: Plan) => Promise<void>;
}) {
  const initialIntent: Intent = /\b(leg|lower|quad|hamstring|glute|calf)\b/i.test(handoffText)
    ? 'legs'
    : /\b(push|chest|shoulder|tricep)\b/i.test(handoffText)
      ? 'push'
      : /\b(pull|back|bicep|row)\b/i.test(handoffText)
        ? 'pull'
        : /\b(full body|whole body|total body)\b/i.test(handoffText)
          ? 'full'
          : /\b(walk|move|mobility|easy|light)\b/i.test(handoffText)
            ? 'move'
            : 'upper';
  const [intent, setIntent] = useState<Intent>(initialIntent);
  const [draft, setDraft] = useState<DraftMovement[]>(preparedPlan?.exercises ?? []);
  const [manualOpen, setManualOpen] = useState(true);
  const [manualName, setManualName] = useState('');
  const [manualSets, setManualSets] = useState(3);
  const [manualReps, setManualReps] = useState(10);
  const [starting, setStarting] = useState(false);

  const learned = useMemo(() => {
    const map = new Map<string, { name: string; appearances: number; last: Session['sets'][number]; latestAt: string }>();
    const completed = history.filter((session) => session.status === 'complete').sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    for (const session of completed) {
      const seen = new Set<string>();
      for (const set of session.sets) {
        const key = set.exercise.trim().toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const lastSet = [...session.sets].reverse().find((candidate) => candidate.done && candidate.exercise.trim().toLowerCase() === key) ?? set;
        const existing = map.get(key);
        map.set(key, {
          name: set.exercise,
          appearances: (existing?.appearances ?? 0) + 1,
          last: existing?.last ?? lastSet,
          latestAt: existing?.latestAt ?? session.startedAt,
        });
      }
    }
    return [...map.values()].sort((a, b) => b.appearances - a.appearances || b.latestAt.localeCompare(a.latestAt)).slice(0, 6);
  }, [history]);

  const lastWorkout = useMemo(
    () => history.filter((session) => session.status === 'complete').sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] ?? null,
    [history],
  );

  function addMovement(name: string, sets = 3, reps = 10, load = 0) {
    const clean = cleanName(name).slice(0, 70);
    if (!clean) return;
    setDraft((current) => [...current, {
      id: crypto.randomUUID(),
      name: clean,
      sets: Math.min(8, Math.max(1, sets)),
      reps: Math.min(30, Math.max(1, reps)),
      load: Math.min(1500, Math.max(0, load)),
      restSeconds: 90,
    }]);
    setManualName('');
    setManualOpen(false);
  }

  function addScouted(result: MachineScoutResult) {
    addMovement(result.name, 3, 10, 0);
    return Promise.resolve();
  }

  const sessionTitle = preparedPlan?.title || `${intentLabels[intent]} · freestyle`;

  async function start() {
    setStarting(true);
    try {
      await onStart({ title: sessionTitle, unit, exercises: draft });
    } finally {
      setStarting(false);
    }
  }

  return (
    <section className="perf-freestyle perf-freestyle-v2">
      <div className="perf-freestyle-hero">
        <div>
          <span className="eyebrow">FREESTYLE / LIVE BUILD</span>
          <h2>Start training. Build the rest as you go.</h2>
          <p>Pick the direction. The workout can begin immediately — then add machines and movements from the floor.</p>
          {handoffText && <p className="perf-caption"><strong>Aethelios brief:</strong> {handoffText}</p>}
          {preparedPlan && <p className="perf-caption"><strong>Prepared for review:</strong> {preparedPlan.exercises.length} movements. Edit anything below before you start.</p>}
        </div>
        {lastWorkout && (
          <button type="button" disabled={busy} onClick={() => setDraft(movementFromHistory(lastWorkout))}>
            Use last session
          </button>
        )}
      </div>

      <div className="perf-intent-rail" role="group" aria-label="Today's training intent">
        {(Object.keys(intentLabels) as Intent[]).map((key) => (
          <button type="button" key={key} aria-pressed={intent === key} onClick={() => setIntent(key)}>
            {intentLabels[key]}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="perf-primary perf-start-now"
        disabled={busy || starting}
        onClick={() => void start()}
      >
        {starting ? 'Opening training…' : draft.length ? 'Start this workout →' : 'Start training now →'}
      </button>

      <div className="perf-builder-actions" aria-label="Add movements">
        <button type="button" onClick={() => setManualOpen((open) => !open)}>＋ Add movement</button>
        <span>or</span>
        <span>scan the machine in front of you</span>
      </div>

      <MachineScout disabled={busy} onAdd={addScouted} />

      {manualOpen && (
        <form
          className="perf-quick-sheet"
          onSubmit={(event) => {
            event.preventDefault();
            addMovement(manualName, manualSets, manualReps);
          }}
        >
          <div className="perf-quick-sheet-head">
            <div>
              <span className="eyebrow">QUICK ADD</span>
              <h3>Add a movement.</h3>
            </div>
            <button type="button" onClick={() => setManualOpen(false)} aria-label="Close quick add">×</button>
          </div>
          <label>
            Movement
            <input autoFocus value={manualName} maxLength={70} placeholder="Incline plate-loaded press" onChange={(event) => setManualName(event.target.value)} />
          </label>
          <div className="perf-stepper-row">
            <label>
              Sets
              <input type="number" inputMode="numeric" min={1} max={8} value={manualSets} onChange={(event) => setManualSets(event.target.valueAsNumber || 1)} />
            </label>
            <label>
              Rep target
              <input type="number" inputMode="numeric" min={1} max={30} value={manualReps} onChange={(event) => setManualReps(event.target.valueAsNumber || 1)} />
            </label>
          </div>
          <button className="perf-primary" aria-label="Add movement" disabled={busy || !manualName.trim()}>Add to workout →</button>
        </form>
      )}

      {learned.length > 0 && (
        <section className="perf-learned-movements">
          <div>
            <span className="eyebrow">AETHELIOS REMEMBERS</span>
            <h3>Your usual movements.</h3>
          </div>
          <div className="perf-learned-rail">
            {learned.map((item) => (
              <button
                type="button"
                key={item.name.toLowerCase()}
                disabled={busy}
                onClick={() => addMovement(item.name, 3, item.last.reps ?? item.last.targetReps, item.last.load ?? item.last.targetLoad)}
              >
                <strong>{item.name}</strong>
                <span>{item.appearances} session{item.appearances === 1 ? '' : 's'}</span>
                <small>last · {item.last.reps ?? item.last.targetReps} × {item.last.load ?? item.last.targetLoad} {unit}</small>
              </button>
            ))}
          </div>
        </section>
      )}

      {draft.length > 0 && (
        <section className="perf-session-queue">
          <div className="perf-session-composer-heading">
            <div>
              <span className="eyebrow">STARTING QUEUE</span>
              <h3>{sessionTitle}</h3>
            </div>
            <strong>{draft.length}</strong>
          </div>
          <ol>
            {draft.map((movement, index) => (
              <li key={movement.id}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <strong>{movement.name}</strong>
                  <small>{movement.sets} sets · {movement.reps} reps</small>
                </div>
                <button type="button" aria-label={`Remove ${movement.name}`} onClick={() => setDraft((current) => current.filter((item) => item.id !== movement.id))}>×</button>
              </li>
            ))}
          </ol>
        </section>
      )}
    </section>
  );
}
