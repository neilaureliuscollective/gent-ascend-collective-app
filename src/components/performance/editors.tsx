'use client';
import { ChoiceGroup } from '@/components/interaction/choice-group';
import { ExercisePicker } from './exercise-picker';
import { catalogExercise, finalizeExerciseNames } from '@/domains/performance/catalog';
import { useState } from 'react';
import { defaultProfile, goalLabels } from '@/domains/performance/model';
import type { Profile, Plan, Checkin } from '@/domains/performance/schema';
export function ProfileEditor({
  initial,
  busy,
  save,
  close,
}: {
  close?: () => void;
  initial: Profile | null;
  busy: boolean;
  save: (value: Profile) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Profile>(initial ?? defaultProfile);
  const [step, setStep] = useState(initial ? 4 : 0);
  const steps = 5;

  function finish() {
    if (initial && JSON.stringify(initial) === JSON.stringify(draft)) {
      close?.();
      return;
    }
    void save(draft);
  }

  function next() {
    if (step >= steps - 1) finish();
    else setStep((value) => Math.min(steps - 1, value + 1));
  }

  const progress = ((step + 1) / steps) * 100;

  return (
    <div className="perf-calibration" aria-live="polite">
      <div className="perf-calibration-progress" aria-hidden="true">
        <i style={{ width: `${progress}%` }} />
      </div>

      <div className="perf-calibration-head">
        <span className="eyebrow">AETHELIOS / TRAINING CALIBRATION</span>
        <span>{step + 1} / {steps}</span>
      </div>

      {step === 0 && (
        <section className="perf-calibration-step">
          <p className="eyebrow">START HERE</p>
          <h2>What are we building right now?</h2>
          <p>This sets the bias. It does not lock you into a program.</p>
          <ChoiceGroup
            label="Training direction"
            value={draft.goal}
            options={Object.entries(goalLabels).map(([value, label]) => ({ value, label }))}
            onChange={(value) => setDraft({ ...draft, goal: value as Profile['goal'] })}
            disabled={busy}
          />
        </section>
      )}

      {step === 1 && (
        <section className="perf-calibration-step">
          <p className="eyebrow">YOUR BASELINE</p>
          <h2>Where are you coming from?</h2>
          <p>Aethelios uses this to decide how much guidance to put in front of you.</p>
          <ChoiceGroup
            label="Experience"
            value={draft.experience}
            options={[
              { value: 'new', label: 'Getting started' },
              { value: 'returning', label: 'Coming back' },
              { value: 'consistent', label: 'Training consistently' },
            ]}
            onChange={(value) => setDraft({ ...draft, experience: value as Profile['experience'] })}
            disabled={busy}
          />
        </section>
      )}

      {step === 2 && (
        <section className="perf-calibration-step">
          <p className="eyebrow">YOUR ENVIRONMENT</p>
          <h2>What do you usually train with?</h2>
          <p>This gives Machine Scout and movement suggestions the right context.</p>
          <ChoiceGroup
            label="Equipment"
            value={draft.equipment}
            options={[
              { value: 'gym', label: 'Full gym' },
              { value: 'dumbbells', label: 'Dumbbells' },
              { value: 'bodyweight', label: 'Bodyweight' },
            ]}
            onChange={(value) => setDraft({ ...draft, equipment: value as Profile['equipment'] })}
            disabled={busy}
          />
        </section>
      )}

      {step === 3 && (
        <section className="perf-calibration-step">
          <p className="eyebrow">REAL LIFE</p>
          <h2>How much room does training get?</h2>
          <p>Give us your normal week, not your perfect week.</p>
          <div className="perf-calibration-numbers">
            <label>
              Sessions / week
              <input
                type="number"
                inputMode="numeric"
                min="1"
                max="6"
                value={draft.daysPerWeek}
                onChange={(e) => setDraft({ ...draft, daysPerWeek: e.target.valueAsNumber || 1 })}
              />
            </label>
            <label>
              Minutes / session
              <input
                type="number"
                inputMode="numeric"
                min="10"
                max="120"
                step="5"
                value={draft.minutes}
                onChange={(e) => setDraft({ ...draft, minutes: e.target.valueAsNumber || 10 })}
              />
            </label>
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="perf-calibration-step">
          <p className="eyebrow">CALIBRATED</p>
          <h2>Aethelios has the starting signal.</h2>
          <p>Nothing here is permanent. Performance should learn from what you actually do next.</p>
          <dl className="direction-summary perf-calibration-summary">
            <div><dt>Direction</dt><dd>{goalLabels[draft.goal]}</dd></div>
            <div><dt>Experience</dt><dd>{draft.experience}</dd></div>
            <div><dt>Environment</dt><dd>{draft.equipment}</dd></div>
            <div><dt>Cadence</dt><dd>{draft.daysPerWeek} × {draft.minutes} min</dd></div>
          </dl>
          <label className="perf-calibration-quiet">
            Anything training should account for?
            <textarea
              maxLength={500}
              rows={3}
              value={draft.limitations}
              placeholder="Optional"
              onChange={(e) => setDraft({ ...draft, limitations: e.target.value })}
            />
          </label>
          <label className="perf-calibration-unit">
            Weight unit
            <select value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value as Profile['unit'] })}>
              <option value="lb">lb</option>
              <option value="kg">kg</option>
            </select>
          </label>
        </section>
      )}

      <div className="perf-calibration-actions">
        {step > 0 && <button type="button" disabled={busy} onClick={() => setStep((value) => value - 1)}>Back</button>}
        <button type="button" className="perf-primary" disabled={busy} onClick={next}>
          {step === steps - 1 ? (initial ? 'Save calibration →' : 'Enter Performance →') : 'Continue →'}
        </button>
      </div>
    </div>
  );
}
export function PlanEditor({
  initial,
  busy,
  save,
}: {
  initial: Plan;
  busy: boolean;
  save: (value: Plan) => Promise<void>;
}) {
  const [draft, setDraft] = useState(initial);
  const [picker, setPicker] = useState<number | 'add' | null>(null);
  function update(index: number, patch: Partial<Plan['exercises'][number]>) {
    setDraft((d) => ({
      ...d,
      exercises: d.exercises.map((x, i) => (i === index ? { ...x, ...patch } : x)),
    }));
  }
  return (
    <form
      className="perf-form"
      onSubmit={(e) => {
        e.preventDefault();
        void save(finalizeExerciseNames(draft, initial));
      }}
    >
      <div className="perf-form-heading">
        <span className="eyebrow">02 / Your repeatable session</span>
        <h2>Shape your plan.</h2>
        <p>
          A starting template you control. Choose suitable movements and a comfortable load before
          training.
        </p>
      </div>
      <label>
        Session name
        <input
          maxLength={80}
          required
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
      </label>
      <p className="perf-caption">
        Loads use {draft.unit}. Use zero for bodyweight. This plan retains its unit when profile
        preferences change.
      </p>
      {picker !== null && (
        <ExercisePicker
          exclude={draft.exercises.map((e) => e.id)}
          replacing={typeof picker === 'number' ? draft.exercises[picker]?.name : undefined}
          close={() => setPicker(null)}
          choose={(entry) => {
            const next = catalogExercise(entry);
            setDraft((d) => ({
              ...d,
              exercises:
                picker === 'add'
                  ? [...d.exercises, next]
                  : d.exercises.map((e, i) => (i === picker ? next : e)),
            }));
            setPicker(null);
          }}
        />
      )}
      {draft.exercises.map((exercise, index) => (
        <fieldset className="perf-exercise-editor" key={exercise.id}>
          <legend>Movement {index + 1}</legend>
          <label>
            Exercise name
            <input
              aria-label={`Exercise ${index + 1} name`}
              maxLength={70}
              required
              value={exercise.name}
              onChange={(e) => update(index, { name: e.target.value })}
            />
          </label>
          <button type="button" disabled={busy} onClick={() => setPicker(index)}>
            Replace movement {index + 1} from library
          </button>
          <label>
            Progression for this movement
            <select
              aria-label={`Exercise ${index + 1} progression`}
              value={exercise.progression ?? 'review'}
              onChange={(e) =>
                update(index, { progression: e.target.value as 'manual' | 'review' })
              }
            >
              <option value="review">Review eligible rep increases</option>
              <option value="manual">Keep targets manual</option>
            </select>
          </label>
          <div className="perf-fields perf-fields-four">
            {(
              [
                ['sets', 'Sets', 1, 8, 1],
                ['reps', 'Reps', 1, 30, 1],
                ['load', `Load · ${draft.unit}`, 0, 1500, 0.5],
                ['restSeconds', 'Rest · sec', 15, 600, 15],
              ] as const
            ).map(([key, label, min, max, step]) => (
              <label key={key}>
                {label}
                <input
                  aria-label={`Exercise ${index + 1} ${label}`}
                  type="number"
                  required
                  min={min}
                  max={max}
                  step={step}
                  value={exercise[key]}
                  onChange={(e) => update(index, { [key]: e.target.valueAsNumber })}
                />
              </label>
            ))}
          </div>
          <div className="perf-inline">
            <button
              type="button"
              disabled={index === 0}
              onClick={() =>
                setDraft((d) => {
                  const exercises = [...d.exercises];
                  [exercises[index - 1], exercises[index]] = [
                    exercises[index]!,
                    exercises[index - 1]!,
                  ];
                  return { ...d, exercises };
                })
              }
            >
              Move up
            </button>
            <button
              type="button"
              disabled={draft.exercises.length === 1}
              onClick={() =>
                setDraft({ ...draft, exercises: draft.exercises.filter((_, i) => i !== index) })
              }
            >
              Remove
            </button>
          </div>
        </fieldset>
      ))}
      <p className="perf-caption">
        Renaming a custom movement starts a new identity and clears its load when saved. Manual
        targets stay yours to change; eligible increases always require approval.
      </p>
      <div className="perf-inline">
        <button
          type="button"
          disabled={draft.exercises.length >= 12}
          onClick={() =>
            setDraft({
              ...draft,
              exercises: [
                ...draft.exercises,
                { id: crypto.randomUUID(), name: '', sets: 2, reps: 8, load: 0, restSeconds: 90 },
              ],
            })
          }
        >
          Add movement
        </button>
        <button
          type="button"
          disabled={busy || draft.exercises.length >= 12}
          onClick={() => setPicker('add')}
        >
          Add from exercise library
        </button>
        <button className="perf-primary" disabled={busy}>
          Save training plan
        </button>
      </div>
    </form>
  );
}
export function CheckinEditor({
  initial,
  busy,
  save,
}: {
  initial: Checkin;
  busy: boolean;
  save: (value: Checkin) => Promise<void>;
}) {
  const [draft, setDraft] = useState(initial);
  return (
    <form
      className="perf-form"
      onSubmit={(e) => {
        e.preventDefault();
        void save(draft);
      }}
    >
      <div className="perf-form-heading">
        <span className="eyebrow">Your check-in / {initial.day}</span>
        <h2>How are you arriving?</h2>
        <p>Record what you know. Empty fields stay unknown.</p>
      </div>
      <div className="perf-fields">
        <label>
          Sleep · hours
          <input
            type="number"
            min="0"
            max="24"
            step="0.25"
            value={draft.sleepMinutes === null ? '' : draft.sleepMinutes / 60}
            onChange={(e) =>
              setDraft({
                ...draft,
                sleepMinutes:
                  e.target.value === '' ? null : Math.round(e.target.valueAsNumber * 60),
              })
            }
          />
        </label>
        <label>
          Energy
          <select
            value={draft.energy ?? ''}
            onChange={(e) =>
              setDraft({ ...draft, energy: e.target.value === '' ? null : Number(e.target.value) })
            }
          >
            <option value="">Not recorded</option>
            {['Very low', 'Low', 'Steady', 'Good', 'Strong'].map((label, i) => (
              <option key={label} value={i + 1}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Muscle soreness
          <select
            value={draft.soreness ?? ''}
            onChange={(e) =>
              setDraft({
                ...draft,
                soreness: e.target.value ? (e.target.value as Checkin['soreness']) : null,
              })
            }
          >
            <option value="">Not recorded</option>
            <option value="none">None</option>
            <option value="mild">Mild</option>
            <option value="high">High</option>
          </select>
        </label>
        <label>
          Body weight · {draft.unit}
          <input
            type="number"
            min="20"
            max="700"
            step="0.1"
            value={draft.weight ?? ''}
            onChange={(e) =>
              setDraft({ ...draft, weight: e.target.value === '' ? null : e.target.valueAsNumber })
            }
          />
        </label>
      </div>
      <details>
        <summary>Nutrition & hydration · optional</summary>
        <p className="perf-caption">
          Enter totals from your own records. A partial day is never treated as a complete intake
          log.
        </p>
        <div className="perf-fields">
          {(
            [
              ['calories', 'Calories · kcal', 15000],
              ['protein', 'Protein · grams', 1000],
              ['waterMl', 'Water · ml', 15000],
            ] as const
          ).map(([key, label, max]) => (
            <label key={key}>
              {label}
              <input
                type="number"
                min="0"
                max={max}
                value={draft[key] ?? ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    [key]: e.target.value === '' ? null : e.target.valueAsNumber,
                  })
                }
              />
            </label>
          ))}
        </div>
        <label className="perf-check">
          <input
            type="checkbox"
            checked={draft.nutritionComplete}
            onChange={(e) => setDraft({ ...draft, nutritionComplete: e.target.checked })}
          />
          These nutrition totals cover my full day
        </label>
      </details>
      <button className="perf-primary" disabled={busy}>
        Save check-in
      </button>
    </form>
  );
}
