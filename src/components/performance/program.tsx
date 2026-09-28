'use client';
import { useState } from 'react';
import type { PerformanceData, Prescription, Program } from '@/domains/performance/schema';
import {
  estimatedMinutes,
  modeLabels,
  nextProgramSlot,
  preparationChanges,
  preparationSignals,
  preparePlan,
} from '@/domains/performance/program';
import { PlanEditor } from './editors';
export function ProgramEditor({
  initial,
  busy,
  save,
}: {
  initial: Program;
  busy: boolean;
  save: (p: Program) => Promise<void>;
}) {
  const [draft, setDraft] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const selected = draft.sessions.find((s) => s.id === editing);
  if (selected)
    return (
      <div>
        <PlanEditor
          key={selected.id}
          initial={selected.plan}
          busy={busy}
          save={async (plan) => {
            setDraft((d) => ({
              ...d,
              sessions: d.sessions.map((s) => (s.id === selected.id ? { ...s, plan } : s)),
            }));
            setEditing(null);
          }}
        />
        <p className="perf-caption">
          Session edits are staged here. Save the whole program to sync them.
        </p>
        <button onClick={() => setEditing(null)}>Cancel session edits</button>
      </div>
    );
  return (
    <form
      className="perf-form"
      onSubmit={(e) => {
        e.preventDefault();
        void save(draft);
      }}
    >
      <div className="perf-form-heading">
        <span className="eyebrow">YOUR REPEATING PROGRAM</span>
        <h2>Build your training rhythm.</h2>
        <p>
          Choose the sessions you want to repeat, in order. Completion advances the cycle. Days off
          leave the next session waiting.
        </p>
      </div>
      <label>
        Program name
        <input
          required
          maxLength={80}
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
      </label>
      <ol className="perf-program-editor">
        {draft.sessions.map((s, i) => (
          <li key={s.id}>
            <span className="eyebrow">SESSION {String(i + 1).padStart(2, '0')}</span>
            <h3>{s.plan.title}</h3>
            <p>
              {s.plan.exercises.length} movements ·{' '}
              {s.plan.exercises.reduce((n, e) => n + e.sets, 0)} sets · {s.plan.unit}
            </p>
            <div className="perf-inline">
              <button
                type="button"
                onClick={() => setEditing(s.id)}
                aria-label={`Edit session ${i + 1}`}
              >
                Edit session
              </button>
              <button
                type="button"
                disabled={draft.sessions.length >= 6}
                onClick={() => {
                  const copy = {
                    id: crypto.randomUUID(),
                    plan: {
                      ...structuredClone(s.plan),
                      title: `${s.plan.title.slice(0, 65)} · copy`,
                    },
                  };
                  setDraft({ ...draft, sessions: [...draft.sessions, copy] });
                  setEditing(copy.id);
                }}
              >
                Duplicate
              </button>
              <button
                type="button"
                disabled={i === 0}
                onClick={() => {
                  const sessions = [...draft.sessions];
                  [sessions[i - 1], sessions[i]] = [sessions[i]!, sessions[i - 1]!];
                  setDraft({ ...draft, sessions });
                }}
              >
                Move earlier
              </button>
              <button
                type="button"
                disabled={draft.sessions.length === 1}
                onClick={() =>
                  setDraft({ ...draft, sessions: draft.sessions.filter((x) => x.id !== s.id) })
                }
              >
                Remove session
              </button>
            </div>
          </li>
        ))}
      </ol>
      <p className="perf-caption">
        Up to six sessions. Duplicate and edit to create another day or an equipment-specific
        option. Program edits never rewrite a workout already started.
      </p>
      <button className="perf-primary" disabled={busy}>
        Save program
      </button>
    </form>
  );
}
export function ProgramCycle({ data }: { data: PerformanceData }) {
  if (!data.program) return null;
  return (
    <section className="perf-cycle" aria-label="Training cycle">
      <div>
        <p className="eyebrow">YOUR TRAINING CYCLE</p>
        <h3>{data.program.data.title}</h3>
      </div>
      <ol>
        {data.program.data.sessions.map((s, i) => (
          <li key={s.id} aria-current={s.id === data.program?.nextSlotId ? 'step' : undefined}>
            <span>{String(i + 1).padStart(2, '0')}</span>
            <div>
              {s.plan.title}
              <small>{s.id === data.program?.nextSlotId ? 'NEXT UP' : 'IN YOUR ROTATION'}</small>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
export function SessionPreparation({
  data,
  busy,
  start,
  edit,
  recover,
}: {
  data: PerformanceData;
  busy: boolean;
  start: (p: Prescription) => void;
  edit: () => void;
  recover: () => void;
}) {
  const next = nextProgramSlot(data)!;
  const [slotId, setSlotId] = useState(next.id);
  const [mode, setMode] = useState<Prescription['mode']>('planned');
  const [budget, setBudget] = useState(data.profile?.data.minutes ?? 40);
  const slot = data.program!.data.sessions.find((s) => s.id === slotId) ?? next;
  const plan = preparePlan(slot.plan, mode, Number.isFinite(budget) ? budget : 40);
  const changes = preparationChanges(slot.plan, plan);
  const signals = preparationSignals(data);
  return (
    <section className="perf-preparation">
      <p className="eyebrow">BEFORE YOU BEGIN / YOUR DECISION</p>
      <h2>Meet today where it is.</h2>
      <label>
        Session to train
        <select value={slot.id} onChange={(e) => setSlotId(e.target.value)}>
          {data.program!.data.sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.plan.title}
              {s.id === data.program?.nextSlotId ? ' · next up' : ''}
            </option>
          ))}
        </select>
      </label>
      {slot.id !== data.program?.nextSlotId && (
        <p className="perf-caption">Training out of order leaves your next-up session waiting.</p>
      )}
      {signals.length > 0 && (
        <aside className="perf-signals" aria-label="Before training">
          <span className="eyebrow">WHAT YOUR RECORDS SAY</span>
          {signals.map((s) => (
            <p key={s}>{s}</p>
          ))}
          <p className="perf-caption">
            Self-reports inform your decision. They do not measure readiness.
          </p>
        </aside>
      )}
      <div className="perf-choice" role="group" aria-label="Session approach">
        {Object.entries(modeLabels).map(([key, label]) => (
          <button
            key={key}
            aria-pressed={mode === key}
            onClick={() => setMode(key as Prescription['mode'])}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === 'shorter' && (
        <label>
          Available minutes
          <input
            type="number"
            inputMode="numeric"
            min={10}
            max={120}
            step={1}
            value={Number.isFinite(budget) ? budget : ''}
            onChange={(e) => setBudget(e.target.valueAsNumber)}
          />
        </label>
      )}
      <div className="perf-prescription">
        <span className="eyebrow">{modeLabels[mode].toUpperCase()} / TODAY ONLY</span>
        <h3>{plan.title}</h3>
        <p>
          {plan.exercises.reduce((n, e) => n + e.sets, 0)} sets · about {estimatedMinutes(plan)} min
        </p>
        <ol className="perf-movements">
          {plan.exercises.map((e) => (
            <li key={e.id}>
              <span>{e.name}</span>
              <small>
                {e.sets} × {e.reps} · {e.load} {plan.unit}
              </small>
            </li>
          ))}
        </ol>
        {changes.length > 0 ? (
          <ul className="perf-changes">
            {changes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        ) : (
          <p>No target changes.</p>
        )}
        <p className="perf-caption">
          {mode === 'shorter'
            ? 'Extra sets are removed from the end first, then later movements. Put priorities first in your program. '
            : mode === 'lighter'
              ? 'One fewer set per movement, with at least one retained. '
              : ''}
          Loads, reps and rest stay unchanged. Time includes a five-minute warm-up allowance and
          estimated set/transition time; take the time you need.
        </p>
        {mode === 'shorter' && estimatedMinutes(plan) > budget && (
          <p role="status">
            The smallest session still exceeds this estimate. Choose recovery or revise the session.
          </p>
        )}
      </div>
      <p className="perf-caption">
        Starting accepts this session and keeps it on this device for offline use until removed or
        signed out. Reconnect to sync. Your saved program stays unchanged.
      </p>
      <div className="perf-inline">
        <button
          className="perf-primary"
          disabled={busy || !Number.isInteger(budget) || budget < 10 || budget > 120}
          onClick={() =>
            start({
              programVersion: data.program!.version,
              slotId: slot.id,
              mode,
              timeBudget: budget,
              originalPlan: slot.plan,
              plan,
            })
          }
        >
          Accept & start workout
        </button>
        <button onClick={recover}>Choose recovery today</button>
        <button onClick={edit}>Edit program</button>
      </div>
    </section>
  );
}
export function SessionDecision({ prescription }: { prescription: Prescription }) {
  const changes = preparationChanges(prescription.originalPlan, prescription.plan);
  return (
    <div className="perf-decision-record">
      <p className="perf-caption">
        {modeLabels[prescription.mode]} · program revision {prescription.programVersion} ·{' '}
        {prescription.plan.exercises.reduce((n, e) => n + e.sets, 0)} prescribed sets
        {prescription.mode === 'shorter' ? ` · ${prescription.timeBudget}-minute budget` : ''}.
      </p>
      {changes.length > 0 && (
        <details>
          <summary>What changed for this session</summary>
          <ul>
            {changes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p className="perf-caption">
            You accepted this adjustment. The source program is unchanged.
          </p>
        </details>
      )}
    </div>
  );
}
