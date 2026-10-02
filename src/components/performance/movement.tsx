'use client';
import { useRef, useState, type FormEvent } from 'react';
import { shiftDay } from '@/domains/performance/fuel';
import { movementNames, movementReview } from '@/domains/performance/movement';
import {
  movementSchema,
  type Movement,
  type Mutation,
  type PerformanceData,
  type Stored,
} from '@/domains/performance/schema';
type Save = (command: Mutation) => Promise<boolean>;
export function MovementSpace({
  data,
  busy,
  save,
}: {
  data: PerformanceData;
  busy: boolean;
  save: Save;
}) {
  const [editor, setEditor] = useState<Stored<Movement> | null>(null);
  const report = movementReview(data);
  if (editor)
    return (
      <MovementEditor
        initial={editor}
        today={data.today}
        busy={busy}
        save={save}
        close={() => setEditor(null)}
      />
    );
  return (
    <section className="perf-movement" aria-label="Movement records">
      <p className="eyebrow">MOVEMENT / BEYOND THE WEIGHT ROOM</p>
      <h2>Record the rest of your practice.</h2>
      <p>Cardio and mobility have their own record. Log what you did, in the units that fit.</p>
      <button
        className="perf-primary"
        disabled={busy}
        onClick={() =>
          setEditor({
            version: 0,
            updatedAt: '',
            data: {
              id: crypto.randomUUID(),
              day: data.today,
              kind: 'walk',
              minutes: 20,
              distance: null,
              unit: 'mi',
              intensity: null,
              note: '',
              voided: false,
            },
          })
        }
      >
        Record activity
      </button>
      <section className="perf-recovery-section" aria-label="Seven-day movement">
        <p className="eyebrow">LAST SEVEN DAYS</p>
        <dl className="perf-fuel-totals">
          <div>
            <dt>Cardio recorded</dt>
            <dd>{report.cardioMinutes} min</dd>
          </div>
          <div>
            <dt>Mobility recorded</dt>
            <dd>{report.mobilityMinutes} min</dd>
          </div>
          <div>
            <dt>Days with entries</dt>
            <dd>{report.recordedDays}/7</dd>
          </div>
        </dl>
        <p className="perf-caption">
          {report.unknownIntensityMinutes} cardio minutes have no intensity recorded. No entry means
          unknown activity, not a rest day.
        </p>
        {report.distance.length > 0 && (
          <details>
            <summary>Recorded distance by activity</summary>
            <ul>
              {report.distance.map((r) => (
                <li key={r.kind}>
                  {movementNames[r.kind]} · {r.km.toFixed(2)} km across {r.records} distance entries
                </li>
              ))}
            </ul>
            <p className="perf-caption">
              Miles are converted for these totals. Original units stay in each record.
            </p>
          </details>
        )}
      </section>
      <section aria-label="Activity history">
        <p className="eyebrow">YOUR LAST 28 DAYS</p>
        <h3>Recent movement.</h3>
        {report.records.length ? (
          <ol className="perf-movement-history">
            {report.records.map((r) => (
              <li key={r.data.id}>
                <div>
                  <time dateTime={r.data.day}>{r.data.day}</time>
                  <h4>
                    {movementNames[r.data.kind]} · {r.data.minutes} min
                  </h4>
                  <p>
                    {r.data.distance === null ? '' : `${r.data.distance} ${r.data.unit} · `}
                    {r.data.kind === 'mobility'
                      ? 'Duration recorded'
                      : (r.data.intensity ?? 'Intensity not recorded')}
                  </p>
                  {r.data.note && <p>{r.data.note}</p>}
                </div>
                <button
                  disabled={busy}
                  aria-label={`Edit ${movementNames[r.data.kind]} on ${r.data.day}`}
                  onClick={() => setEditor(structuredClone(r))}
                >
                  Edit
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p>No activities recorded in this window.</p>
        )}
      </section>
    </section>
  );
}
function MovementEditor({
  initial,
  today,
  busy,
  save,
  close,
}: {
  initial: Stored<Movement>;
  today: string;
  busy: boolean;
  save: Save;
  close: () => void;
}) {
  const [draft, setDraft] = useState(initial.data);
  const [error, setError] = useState('');
  const [remove, setRemove] = useState(false);
  const receipt = useRef<{ fingerprint: string; command: Mutation } | null>(null);
  async function persist(voided = false) {
    const parsed = movementSchema.safeParse(
      voided ? { ...initial.data, voided: true } : { ...draft, voided: false },
    );
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the activity.');
      return;
    }
    setError('');
    const fingerprint = JSON.stringify(parsed.data);
    if (receipt.current?.fingerprint !== fingerprint)
      receipt.current = {
        fingerprint,
        command: {
          kind: 'movement',
          requestId: crypto.randomUUID(),
          expectedVersion: initial.version,
          payload: parsed.data,
        },
      };
    if (await save(receipt.current.command)) close();
    else
      setError(
        'Your entry is still here. Retry, or cancel and reopen the saved record if it changed elsewhere.',
      );
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    void persist();
  }
  return (
    <form className="perf-form" onSubmit={submit}>
      <p className="eyebrow">COMPLETED ACTIVITY</p>
      <h2>{initial.version ? 'Update your record.' : 'What did you do?'}</h2>
      <div className="perf-fields">
        <label>
          Activity
          <select
            disabled={busy}
            value={draft.kind}
            onChange={(e) => {
              const kind = e.target.value as Movement['kind'];
              setDraft({
                ...draft,
                kind,
                ...(kind === 'mobility' ? { distance: null, intensity: null } : {}),
              });
            }}
          >
            {Object.entries(movementNames).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Activity date
          <input
            disabled={busy}
            type="date"
            required
            min={shiftDay(today, -27)}
            max={today}
            value={draft.day}
            onChange={(e) => setDraft({ ...draft, day: e.target.value })}
          />
        </label>
        <label>
          Duration · minutes
          <input
            type="number"
            inputMode="numeric"
            required
            min="1"
            max="1440"
            step="1"
            disabled={busy}
            value={draft.minutes}
            onChange={(e) => setDraft({ ...draft, minutes: e.target.valueAsNumber })}
          />
        </label>
      </div>
      {draft.kind !== 'mobility' && (
        <>
          <div className="perf-fields">
            <label>
              Distance · optional
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                max="1000"
                step="0.01"
                disabled={busy}
                value={draft.distance ?? ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    distance: e.target.value === '' ? null : e.target.valueAsNumber,
                  })
                }
              />
            </label>
            <label>
              Distance unit
              <select
                disabled={busy}
                value={draft.unit}
                onChange={(e) => {
                  const unit = e.target.value as 'km' | 'mi';
                  setDraft({
                    ...draft,
                    unit,
                    distance:
                      draft.distance === null
                        ? null
                        : Math.round(
                            draft.distance * (unit === 'km' ? 1.609344 : 1 / 1.609344) * 100,
                          ) / 100,
                  });
                }}
              >
                <option value="mi">Miles</option>
                <option value="km">Kilometers</option>
              </select>
            </label>
          </div>
          <label>
            Intensity · self-reported
            <select
              disabled={busy}
              value={draft.intensity ?? ''}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  intensity: e.target.value ? (e.target.value as Movement['intensity']) : null,
                })
              }
            >
              <option value="">Not recorded</option>
              <option value="easy">Easy</option>
              <option value="moderate">Moderate</option>
              <option value="vigorous">Vigorous</option>
            </select>
          </label>
        </>
      )}
      <label>
        Activity note · optional
        <input
          maxLength={240}
          disabled={busy}
          value={draft.note}
          onChange={(e) => setDraft({ ...draft, note: e.target.value })}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <div className="perf-inline">
        <button className="perf-primary" disabled={busy}>
          Save activity
        </button>
        <button type="button" disabled={busy} onClick={close}>
          Cancel
        </button>
      </div>
      {initial.version > 0 &&
        (remove ? (
          <div role="group" aria-label="Confirm removal">
            <p>Remove this entry from your activity summaries? Its saved revisions are retained.</p>
            <button type="button" disabled={busy} onClick={() => void persist(true)}>
              Confirm removal
            </button>
            <button type="button" disabled={busy} onClick={() => setRemove(false)}>
              Keep entry
            </button>
          </div>
        ) : (
          <button type="button" disabled={busy} onClick={() => setRemove(true)}>
            Remove activity
          </button>
        ))}
    </form>
  );
}
