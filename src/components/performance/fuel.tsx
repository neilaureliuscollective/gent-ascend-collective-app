'use client';
import { useRef, useState, type FormEvent } from 'react';
import {
  convertWeight,
  emptyFuelDay,
  fuelReview,
  roundWeight,
  shiftDay,
} from '@/domains/performance/fuel';
import {
  checkinSchema,
  fuelTargetsSchema,
  type Checkin,
  type FuelTargets,
  type Mutation,
  type PerformanceData,
  type Stored,
} from '@/domains/performance/schema';

type Save = (command: Mutation) => Promise<boolean>;
type Editor =
  | { kind: 'targets'; data: FuelTargets; version: number }
  | { kind: 'day'; record: Stored<Checkin> };
const format = (value: number | null, unit = '') =>
  value === null
    ? 'Not recorded'
    : `${Math.round(value).toLocaleString('en-US')}${unit ? ` ${unit}` : ''}`;

export function FuelSpace({
  data,
  busy,
  save,
}: {
  data: PerformanceData;
  busy: boolean;
  save: Save;
}) {
  const [day, setDay] = useState(data.today);
  const [editor, setEditor] = useState<Editor | null>(null);
  const report = fuelReview(data);
  const today = data.checkins.find((c) => c.data.day === data.today)?.data;
  const targets = data.fuelTargets?.data;
  const activeTargets =
    targets &&
    [targets.calories, targets.protein, targets.waterMl, targets.goalWeight].some(
      (v) => v !== null,
    );
  if (editor)
    return editor.kind === 'day' ? (
      <FuelDayEditor
        key={editor.record.data.day}
        initial={editor.record}
        busy={busy}
        save={save}
        close={() => setEditor(null)}
      />
    ) : (
      <FuelTargetEditor
        initial={editor.data}
        version={editor.version}
        busy={busy}
        save={save}
        close={() => setEditor(null)}
      />
    );
  return (
    <section className="perf-fuel" aria-label="Fuel and body">
      <p className="eyebrow">FUEL & BODY / YOUR OWN RECORD</p>
      <h2>See the pattern. Keep the context.</h2>
      <p>Record your daily totals and body weight. Build a clearer picture over time.</p>
      <div className="perf-fuel-capture">
        <label>
          Record date
          <input
            type="date"
            min={shiftDay(data.today, -27)}
            max={data.today}
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </label>
        <button
          className="perf-primary"
          disabled={busy || !day || day > data.today || day < shiftDay(data.today, -27)}
          onClick={() =>
            setEditor({
              kind: 'day',
              record: structuredClone(
                data.checkins.find((c) => c.data.day === day) ?? {
                  data: emptyFuelDay(day, report.unit),
                  version: 0,
                  updatedAt: '',
                },
              ),
            })
          }
        >
          Record intake & weight
        </button>
      </div>
      <section aria-label="Today's fuel">
        <div className="perf-fuel-heading">
          <h3>Today, so far.</h3>
          <span className="eyebrow">
            {today?.nutritionComplete ? 'FULL DAY REPORTED' : 'PARTIAL / NOT CLOSED'}
          </span>
        </div>
        <dl className="perf-fuel-totals">
          {(
            [
              ['Calories', today?.calories ?? null, targets?.calories, 'kcal'],
              ['Protein', today?.protein ?? null, targets?.protein, 'g'],
              ['Water', today?.waterMl ?? null, targets?.waterMl, 'ml'],
            ] as const
          ).map(([label, recorded, target, unit]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{format(recorded, unit)}</dd>
              <span>
                {target == null ? 'No reference set' : `Your reference: ${format(target, unit)}`}
              </span>
            </div>
          ))}
        </dl>
        <p className="perf-caption">
          {activeTargets
            ? 'References are yours to set. They are not calculated prescriptions or historical adherence scores.'
            : 'Targets are optional. You can build your record without them.'}
        </p>
        <button
          className="text-button"
          disabled={busy}
          onClick={() =>
            setEditor({
              kind: 'targets',
              version: data.fuelTargets?.version ?? 0,
              data: structuredClone(
                targets ?? {
                  calories: null,
                  protein: null,
                  waterMl: null,
                  goalWeight: null,
                  unit: report.unit,
                },
              ),
            })
          }
        >
          {activeTargets ? 'Edit my references' : 'Set my references'}
        </button>
      </section>
      <section className="perf-fuel-week" aria-label="Seven-day intake">
        <p className="eyebrow">LAST SEVEN DAYS</p>
        <h3>What your records support.</h3>
        <dl className="perf-fuel-totals">
          <div>
            <dt>Average calories</dt>
            <dd>{format(report.calories.average, 'kcal')}</dd>
            <span>{report.calories.days} complete days with calories</span>
          </div>
          <div>
            <dt>Average protein</dt>
            <dd>{format(report.protein.average, 'g')}</dd>
            <span>{report.protein.days} complete days with protein</span>
          </div>
          <div>
            <dt>Average water recorded</dt>
            <dd>{format(report.water.average, 'ml')}</dd>
            <span>{report.water.days} days with water recorded · may be partial</span>
          </div>
        </dl>
        <p className="perf-caption">
          {report.partialDays} partial intake days are excluded from calorie and protein averages.
          Missing days are not zero.
        </p>
      </section>
      <section className="perf-body-trend" aria-label="Body weight trend">
        <p className="eyebrow">BODY RECORD / 28 DAYS</p>
        <h3>A trend needs more than one reading.</h3>
        {targets?.goalWeight != null && (
          <p>
            Your weight reference:{' '}
            <strong>
              {roundWeight(targets.goalWeight)} {targets.unit}
            </strong>
          </p>
        )}
        <p>
          {report.change === null
            ? 'Record weight on at least three days in each of the latest two weeks to compare their averages.'
            : `Weekly average change: ${report.change > 0 ? '+' : ''}${roundWeight(report.change).toFixed(1)} ${report.unit}.`}
        </p>
        <p className="perf-caption">
          Scale weight is not body composition. These readings do not establish fat loss or explain
          its cause.
        </p>
        <WeightTrend weeks={report.weeks} unit={report.unit} />
        <details className="perf-history">
          <summary>See original weight readings ({report.weightReadings.length})</summary>
          {report.weightReadings.length ? (
            <ul>
              {report.weightReadings.map((r) => (
                <li key={r.day}>
                  <time dateTime={r.day}>{r.day}</time> · {r.value} {r.unit}
                </li>
              ))}
            </ul>
          ) : (
            <p>No readings in this 28-day window.</p>
          )}
        </details>
      </section>
    </section>
  );
}
function WeightTrend({
  weeks,
  unit,
}: {
  weeks: ReturnType<typeof fuelReview>['weeks'];
  unit: 'kg' | 'lb';
}) {
  const values = weeks.flatMap((w) => (w.average === null ? [] : [w.average]));
  const low = values.length ? Math.min(...values) - 1 : 0;
  const high = values.length ? Math.max(...values) + 1 : 1;
  const y = (value: number) => 100 - ((value - low) / (high - low)) * 75;
  return (
    <figure className="perf-weight-figure">
      <figcaption>Weekly averages · {unit} · observed days only</figcaption>
      {values.length > 0 && (
        <svg
          viewBox="0 0 340 120"
          role="img"
          aria-label="Four weekly weight averages. Exact values and reading counts follow."
        >
          <text x="0" y="18">
            {high.toFixed(1)}
          </text>
          <text x="0" y="113">
            {low.toFixed(1)}
          </text>
          {weeks.map((week, i) =>
            week.average === null ? null : (
              <g key={week.start}>
                {i > 0 && weeks[i - 1]!.average !== null && (
                  <line
                    x1={60 + (i - 1) * 85}
                    y1={y(weeks[i - 1]!.average!)}
                    x2={60 + i * 85}
                    y2={y(week.average)}
                  />
                )}
                <circle cx={60 + i * 85} cy={y(week.average)} r="4">
                  <title>
                    {week.start} through {week.end}: {week.average.toFixed(1)} {unit}, {week.days}{' '}
                    readings
                  </title>
                </circle>
              </g>
            ),
          )}
        </svg>
      )}
      <ol className="perf-weight-weeks">
        {weeks.map((week) => (
          <li key={week.start}>
            <span>
              {week.start.slice(5)} — {week.end.slice(5)}
            </span>
            <strong>
              {week.average === null ? 'No readings' : `${week.average.toFixed(1)} ${unit}`}
            </strong>
            <small>{week.days}/7 days recorded</small>
          </li>
        ))}
      </ol>
    </figure>
  );
}
function useRetryCommand() {
  const previous = useRef<{ fingerprint: string; command: Mutation } | null>(null);
  return (command: Mutation) => {
    const fingerprint = JSON.stringify({ ...command, requestId: '' });
    if (previous.current?.fingerprint !== fingerprint) previous.current = { fingerprint, command };
    return previous.current.command;
  };
}
function FuelDayEditor({
  initial,
  busy,
  save,
  close,
}: {
  initial: Stored<Checkin>;
  busy: boolean;
  save: Save;
  close: () => void;
}) {
  const [draft, setDraft] = useState(initial.data);
  const [error, setError] = useState('');
  const retry = useRetryCommand();
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const parsed = checkinSchema.safeParse(draft);
    if (!parsed.success) {
      setError('Check the numbers before saving.');
      return;
    }
    const ok = await save(
      retry({
        kind: 'checkin',
        requestId: crypto.randomUUID(),
        expectedVersion: initial.version,
        payload: parsed.data,
      }),
    );
    if (ok) close();
    else
      setError(
        'Your entries are still here. Retry, or cancel and reopen the saved day if it changed elsewhere.',
      );
  }
  return (
    <form className="perf-form perf-fuel-editor" onSubmit={submit}>
      <p className="eyebrow">DAILY TOTALS / {draft.day}</p>
      <h2>Record what you know.</h2>
      <p>Use totals from your own records. Leave anything unknown empty.</p>
      <div className="perf-fields">
        {(
          [
            ['calories', 'Calories · kcal', 15000, 1],
            ['protein', 'Protein · g', 1000, 0.1],
            ['waterMl', 'Water · ml', 15000, 1],
          ] as const
        ).map(([key, label, max, step]) => (
          <label key={key}>
            {label}
            <input
              type="number"
              disabled={busy}
              inputMode="decimal"
              min="0"
              max={max}
              step={step}
              value={draft[key] ?? ''}
              onChange={(e) =>
                setDraft({ ...draft, [key]: e.target.value === '' ? null : e.target.valueAsNumber })
              }
            />
          </label>
        ))}
      </div>
      <fieldset className="perf-day-state" disabled={busy}>
        <legend>How much of the day is recorded?</legend>
        <button
          type="button"
          aria-pressed={!draft.nutritionComplete}
          onClick={() => setDraft({ ...draft, nutritionComplete: false })}
        >
          Still a partial day
        </button>
        <button
          type="button"
          aria-pressed={draft.nutritionComplete}
          onClick={() => setDraft({ ...draft, nutritionComplete: true })}
        >
          These are my full-day totals
        </button>
      </fieldset>
      <div className="perf-fields">
        <label>
          Body weight
          <input
            type="number"
            disabled={busy}
            inputMode="decimal"
            min="20"
            max="700"
            step="0.1"
            value={draft.weight ?? ''}
            onChange={(e) =>
              setDraft({ ...draft, weight: e.target.value === '' ? null : e.target.valueAsNumber })
            }
          />
        </label>
        <label>
          Weight unit
          <select
            disabled={busy}
            value={draft.unit}
            onChange={(e) => {
              const unit = e.target.value as 'kg' | 'lb';
              setDraft({
                ...draft,
                unit,
                weight:
                  draft.weight === null
                    ? null
                    : roundWeight(convertWeight(draft.weight, draft.unit, unit)),
              });
            }}
          >
            <option value="lb">Pounds · lb</option>
            <option value="kg">Kilograms · kg</option>
          </select>
        </label>
      </div>
      <p className="perf-caption">
        Changing the unit converts this entry. Your sleep, energy and soreness stay as recorded.
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="perf-inline">
        <button className="perf-primary" disabled={busy}>
          Save daily record
        </button>
        <button type="button" disabled={busy} onClick={close}>
          Cancel
        </button>
      </div>
    </form>
  );
}
function FuelTargetEditor({
  initial,
  version,
  busy,
  save,
  close,
}: {
  initial: FuelTargets;
  version: number;
  busy: boolean;
  save: Save;
  close: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState('');
  const retry = useRetryCommand();
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const parsed = fuelTargetsSchema.safeParse(draft);
    if (!parsed.success) {
      setError('Use positive reference values, or leave them empty.');
      return;
    }
    if (
      await save(
        retry({
          kind: 'fuel-targets',
          requestId: crypto.randomUUID(),
          expectedVersion: version,
          payload: parsed.data,
        }),
      )
    )
      close();
    else
      setError(
        'Your references are still here. Retry, or cancel and reopen the saved version if it changed elsewhere.',
      );
  }
  return (
    <form className="perf-form perf-fuel-editor" onSubmit={submit}>
      <p className="eyebrow">YOUR REFERENCES / OPTIONAL</p>
      <h2>Choose what you want to track.</h2>
      <p>Enter targets you have chosen. Nothing is calculated or changed automatically.</p>
      <div className="perf-fields">
        {(
          [
            ['calories', 'Daily calories · kcal', 1, 15000, 1],
            ['protein', 'Daily protein · g', 0.1, 1000, 0.1],
            ['waterMl', 'Daily water · ml', 1, 15000, 1],
            ['goalWeight', 'Goal weight', 20, 700, 0.1],
          ] as const
        ).map(([key, label, min, max, step]) => (
          <label key={key}>
            {label}
            <input
              type="number"
              disabled={busy}
              inputMode="decimal"
              min={min}
              max={max}
              step={step}
              value={draft[key] ?? ''}
              onChange={(e) =>
                setDraft({ ...draft, [key]: e.target.value === '' ? null : e.target.valueAsNumber })
              }
            />
          </label>
        ))}
      </div>
      <label>
        Display weight in
        <select
          disabled={busy}
          value={draft.unit}
          onChange={(e) => {
            const unit = e.target.value as 'kg' | 'lb';
            setDraft({
              ...draft,
              unit,
              goalWeight:
                draft.goalWeight === null
                  ? null
                  : roundWeight(convertWeight(draft.goalWeight, draft.unit, unit)),
            });
          }}
        >
          <option value="lb">Pounds · lb</option>
          <option value="kg">Kilograms · kg</option>
        </select>
      </label>
      <p className="perf-caption">
        A unit change converts the goal. Original readings keep their units. Empty fields remove
        those references when saved.
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="perf-inline">
        <button className="perf-primary" disabled={busy}>
          Save references
        </button>
        <button type="button" disabled={busy} onClick={close}>
          Cancel
        </button>
      </div>
    </form>
  );
}
