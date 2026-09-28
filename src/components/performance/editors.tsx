'use client';
import { useState, type FormEvent } from 'react';
import { defaultProfile, goalLabels } from '@/domains/performance/model';
import type { Profile, Plan, Checkin } from '@/domains/performance/schema';
export function ProfileEditor({
  initial,
  busy,
  save,
}: {
  initial: Profile | null;
  busy: boolean;
  save: (value: Profile) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Profile>(initial ?? defaultProfile);
  function submit(e: FormEvent) {
    e.preventDefault();
    void save(draft);
  }
  return (
    <form className="perf-form" onSubmit={submit}>
      <div className="perf-form-heading">
        <span className="eyebrow">01 / Your foundation</span>
        <h2>Make the practice yours.</h2>
        <p>These are your preferences. You can revise them as life changes.</p>
      </div>
      <div className="perf-fields">
        <label>
          My direction
          <select
            value={draft.goal}
            onChange={(e) => setDraft({ ...draft, goal: e.target.value as Profile['goal'] })}
          >
            {Object.entries(goalLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Training experience
          <select
            value={draft.experience}
            onChange={(e) =>
              setDraft({ ...draft, experience: e.target.value as Profile['experience'] })
            }
          >
            <option value="new">Getting started</option>
            <option value="returning">Returning to training</option>
            <option value="consistent">Training consistently</option>
          </select>
        </label>
        <label>
          Sessions per week
          <input
            type="number"
            min="1"
            max="6"
            required
            value={draft.daysPerWeek}
            onChange={(e) => setDraft({ ...draft, daysPerWeek: e.target.valueAsNumber })}
          />
        </label>
        <label>
          Typical time · minutes
          <input
            type="number"
            min="10"
            max="120"
            required
            value={draft.minutes}
            onChange={(e) => setDraft({ ...draft, minutes: e.target.valueAsNumber })}
          />
        </label>
        <label>
          Equipment
          <select
            value={draft.equipment}
            onChange={(e) =>
              setDraft({ ...draft, equipment: e.target.value as Profile['equipment'] })
            }
          >
            <option value="gym">Gym</option>
            <option value="dumbbells">Dumbbells</option>
            <option value="bodyweight">Bodyweight</option>
          </select>
        </label>
        <label>
          Preferred weight unit
          <select
            value={draft.unit}
            onChange={(e) => setDraft({ ...draft, unit: e.target.value as Profile['unit'] })}
          >
            <option value="lb">Pounds · lb</option>
            <option value="kg">Kilograms · kg</option>
          </select>
        </label>
      </div>
      <label>
        Movements or limitations to account for
        <textarea
          maxLength={500}
          rows={3}
          value={draft.limitations}
          placeholder="Optional. What should your training account for?"
          onChange={(e) => setDraft({ ...draft, limitations: e.target.value })}
        />
      </label>
      <p className="perf-caption">
        When you record a limitation, automatic progression proposals pause. Review exercise choices
        against your own guidance.
      </p>
      <button className="perf-primary" disabled={busy}>
        Save direction
      </button>
    </form>
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
        void save(draft);
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
