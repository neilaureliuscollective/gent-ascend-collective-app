'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { emptyFuelDay, shiftDay } from '@/domains/performance/fuel';
import {
  recoveryActions,
  recoveryOutcomes,
  recoveryReview,
  sleepText,
} from '@/domains/performance/recovery';
import {
  checkinSchema,
  recoveryRoutineSchema,
  type Checkin,
  type Mutation,
  type PerformanceData,
  type RecoveryRoutine,
  type Stored,
} from '@/domains/performance/schema';
type Save = (command: Mutation) => Promise<boolean>;
type Editor =
  | { kind: 'checkin'; record: Stored<Checkin> }
  | { kind: 'routine'; record: Stored<RecoveryRoutine> };
export function RecoverySpace({
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
  const container = useRef<HTMLDivElement>(null);
  const report = recoveryReview(data);
  const today = data.checkins.find((c) => c.data.day === data.today)?.data;
  const routine = report.routines.find((r) => r.record.data.day === data.today)?.record;
  const yesterday = report.routines.find((r) => r.record.data.day === shiftDay(data.today, -1));
  useEffect(() => {
    if (editor) container.current?.querySelector('h2')?.focus();
  }, [editor]);
  function editRoutine(record?: Stored<RecoveryRoutine>) {
    const latest = report.routines[0]?.record.data;
    setEditor({
      kind: 'routine',
      record: structuredClone(
        record ?? {
          version: 0,
          updatedAt: '',
          data: {
            day: data.today,
            action: latest?.action ?? 'quiet-time',
            minutes: latest?.minutes ?? 15,
            cue: latest?.cue ?? '',
            outcome: null,
          },
        },
      ),
    });
  }
  return (
    <div ref={container} className="perf-recovery">
      {editor ? (
        editor.kind === 'checkin' ? (
          <RecoveryCheckin
            initial={editor.record}
            busy={busy}
            save={save}
            close={() => setEditor(null)}
          />
        ) : (
          <RoutineEditor
            initial={editor.record}
            today={data.today}
            busy={busy}
            save={save}
            close={() => setEditor(null)}
          />
        )
      ) : (
        <section aria-label="Recovery and sleep">
          <p className="eyebrow">RESTORE / YOUR OWN RECORD</p>
          <h2>Make room to recover.</h2>
          <p>Notice how you feel. Choose one practice. See what follows.</p>
          <dl className="perf-fuel-totals">
            <div>
              <dt>Sleep recorded today</dt>
              <dd>{sleepText(today?.sleepMinutes ?? null)}</dd>
            </div>
            <div>
              <dt>Energy today</dt>
              <dd>{today?.energy == null ? 'Not recorded' : `${today.energy} / 5`}</dd>
            </div>
            <div>
              <dt>Soreness today</dt>
              <dd>{today?.soreness ?? 'Not recorded'}</dd>
            </div>
          </dl>
          <div className="perf-fuel-capture">
            <label>
              Check-in date
              <input
                type="date"
                value={day}
                min={shiftDay(data.today, -27)}
                max={data.today}
                onChange={(e) => setDay(e.target.value)}
              />
            </label>
            <button
              className="perf-primary"
              disabled={busy || !day || day > data.today || day < shiftDay(data.today, -27)}
              onClick={() =>
                setEditor({
                  kind: 'checkin',
                  record: structuredClone(
                    data.checkins.find((c) => c.data.day === day) ?? {
                      version: 0,
                      updatedAt: '',
                      data: emptyFuelDay(day, data.profile?.data.unit ?? 'lb'),
                    },
                  ),
                })
              }
            >
              Record recovery
            </button>
          </div>
          <section className="perf-recovery-section" aria-label="Today's recovery practice">
            <p className="eyebrow">ONE DELIBERATE PRACTICE</p>
            <h3>
              {routine
                ? recoveryActions[routine.data.action]
                : 'Give recovery a place in your day.'}
            </h3>
            {routine ? (
              <p>
                {routine.data.minutes} minutes{routine.data.cue ? ` · ${routine.data.cue}` : ''}
              </p>
            ) : (
              <p>
                Choose a small routine that fits your schedule, including daytime sleep or shift
                work.
              </p>
            )}
            <button disabled={busy} onClick={() => editRoutine(routine)}>
              {routine ? 'Edit today’s practice' : 'Choose today’s practice'}
            </button>
            {routine && (
              <p className="perf-caption">
                Saved for {data.today}. Review your follow-through tomorrow.
              </p>
            )}
          </section>
          {yesterday && (
            <section className="perf-recovery-section" aria-label="Yesterday's follow-through">
              <p className="eyebrow">YESTERDAY → TODAY</p>
              <h3>What followed your choice?</h3>
              <RoutineResult entry={yesterday} />
              <button disabled={busy} onClick={() => editRoutine(yesterday.record)}>
                Review yesterday’s practice
              </button>
            </section>
          )}
          <section className="perf-recovery-section" aria-label="Seven-day recovery">
            <p className="eyebrow">SEVEN DAYS / SELF-REPORTED</p>
            <h3>Your pattern, with the gaps.</h3>
            <dl className="perf-fuel-totals">
              <div>
                <dt>Average sleep recorded</dt>
                <dd>{sleepText(report.sleep.average)}</dd>
                <span>{report.sleep.days}/7 days recorded</span>
              </div>
              <div>
                <dt>Average energy</dt>
                <dd>
                  {report.energy.average === null
                    ? 'Not recorded'
                    : `${report.energy.average.toFixed(1)} / 5`}
                </dd>
                <span>{report.energy.days}/7 days recorded</span>
              </div>
              <div>
                <dt>High soreness</dt>
                <dd>{report.highSorenessDays} days</dd>
                <span>Of {report.sorenessDays} days with soreness recorded</span>
              </div>
            </dl>
            <ol className="perf-recovery-days" aria-label="Daily recovery observations">
              {report.days.map((d) => (
                <li key={d.day}>
                  <time dateTime={d.day}>{d.day.slice(5)}</time>
                  <div className="perf-sleep-track" aria-hidden="true">
                    {d.sleepMinutes !== null && (
                      <span style={{ width: `${Math.min((d.sleepMinutes / 1440) * 100, 100)}%` }} />
                    )}
                  </div>
                  <strong>{sleepText(d.sleepMinutes)}</strong>
                  <small>
                    Energy {d.energy === null ? 'unknown' : `${d.energy}/5`} · Soreness{' '}
                    {d.soreness ?? 'unknown'}
                  </small>
                </li>
              ))}
            </ol>
            <p className="perf-caption">
              Hours are duration, not sleep quality. Energy and soreness are separate observations.
              Missing days are not zero.
            </p>
          </section>
          <details className="perf-history">
            <summary>Recovery history ({report.routines.length})</summary>
            <p>
              Each practice is paired with the following calendar day. These records do not
              establish what caused a change.
            </p>
            {report.routines.length ? (
              report.routines.map((entry) => (
                <article className="perf-recovery-history" key={entry.record.data.day}>
                  <h3>{entry.record.data.day}</h3>
                  <RoutineResult entry={entry} />
                  {entry.record.data.day < data.today && (
                    <button disabled={busy} onClick={() => editRoutine(entry.record)}>
                      Review practice from {entry.record.data.day}
                    </button>
                  )}
                </article>
              ))
            ) : (
              <p>Your chosen practices will appear here.</p>
            )}
          </details>
        </section>
      )}
    </div>
  );
}
function RoutineResult({
  entry,
}: {
  entry: ReturnType<typeof recoveryReview>['routines'][number];
}) {
  const r = entry.record.data;
  return (
    <>
      <p>
        <strong>{recoveryActions[r.action]}</strong> · {r.minutes} minutes
        {r.cue ? ` · ${r.cue}` : ''}
      </p>
      <p>
        Follow-through: <strong>{r.outcome ? recoveryOutcomes[r.outcome] : 'Not recorded'}</strong>
      </p>
      <p className="perf-caption">
        {entry.pending
          ? `Next-day observations open on ${entry.nextDay}.`
          : entry.observation
            ? `${entry.nextDay} · Sleep ${sleepText(entry.observation.sleepMinutes)} · Energy ${entry.observation.energy ?? 'unknown'}${entry.observation.energy === null ? '' : '/5'} · Soreness ${entry.observation.soreness ?? 'unknown'}`
            : `No check-in for ${entry.nextDay}. Later days do not replace it.`}
      </p>
    </>
  );
}
function useSaveDraft(save: Save, close: () => void) {
  const [error, setError] = useState('');
  const previous = useRef<{ key: string; command: Mutation } | null>(null);
  async function persist(command: Mutation) {
    setError('');
    const key = JSON.stringify({ ...command, requestId: '' });
    if (previous.current?.key !== key) previous.current = { key, command };
    if (await save(previous.current.command)) close();
    else
      setError(
        'Your draft is still here. Retry, or cancel and reopen the saved record if it changed elsewhere.',
      );
  }
  return { error, setError, persist };
}
function RecoveryCheckin({
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
  const { error, setError, persist } = useSaveDraft(save, close);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = checkinSchema.safeParse(draft);
    if (!parsed.success) {
      setError('Check the values before saving.');
      return;
    }
    await persist({
      kind: 'checkin',
      requestId: crypto.randomUUID(),
      expectedVersion: initial.version,
      payload: parsed.data,
    });
  }
  return (
    <form className="perf-form perf-recovery-editor" onSubmit={submit}>
      <p className="eyebrow">RECOVERY CHECK-IN / {draft.day}</p>
      <h2 tabIndex={-1}>How did you arrive today?</h2>
      <p>Record your latest sleep and how you feel on this date. Leave unknown values empty.</p>
      <label>
        Sleep · hours
        <input
          type="number"
          inputMode="decimal"
          min="0"
          max="24"
          step="0.1"
          disabled={busy}
          value={draft.sleepMinutes === null ? '' : Math.round((draft.sleepMinutes / 60) * 10) / 10}
          onChange={(e) =>
            setDraft({
              ...draft,
              sleepMinutes: e.target.value === '' ? null : Math.round(e.target.valueAsNumber * 60),
            })
          }
        />
      </label>
      <fieldset disabled={busy} className="perf-recovery-options">
        <legend>Energy</legend>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={draft.energy === n}
            onClick={() => setDraft({ ...draft, energy: n })}
          >
            {n} · {['Very low', 'Low', 'Steady', 'Good', 'High'][n - 1]}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={draft.energy === null}
          onClick={() => setDraft({ ...draft, energy: null })}
        >
          Energy unknown
        </button>
      </fieldset>
      <fieldset disabled={busy} className="perf-recovery-options">
        <legend>Muscle soreness</legend>
        {(['none', 'mild', 'high'] as const).map((v) => (
          <button
            type="button"
            key={v}
            aria-pressed={draft.soreness === v}
            onClick={() => setDraft({ ...draft, soreness: v })}
          >
            {v === 'none' ? 'No soreness' : v === 'mild' ? 'Mild soreness' : 'High soreness'}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={draft.soreness === null}
          onClick={() => setDraft({ ...draft, soreness: null })}
        >
          Soreness unknown
        </button>
      </fieldset>
      <p className="perf-caption">Your recorded intake and body weight stay as they are.</p>
      {error && <p role="alert">{error}</p>}
      <div className="perf-inline">
        <button className="perf-primary" disabled={busy}>
          Save recovery check-in
        </button>
        <button type="button" disabled={busy} onClick={close}>
          Cancel
        </button>
      </div>
    </form>
  );
}
function RoutineEditor({
  initial,
  today,
  busy,
  save,
  close,
}: {
  initial: Stored<RecoveryRoutine>;
  today: string;
  busy: boolean;
  save: Save;
  close: () => void;
}) {
  const [draft, setDraft] = useState(initial.data);
  const past = draft.day < today;
  const { error, setError, persist } = useSaveDraft(save, close);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = recoveryRoutineSchema.safeParse(draft);
    if (!parsed.success) {
      setError('Choose a practice and 5–60 minutes.');
      return;
    }
    await persist({
      kind: 'recovery-routine',
      requestId: crypto.randomUUID(),
      expectedVersion: initial.version,
      payload: parsed.data,
    });
  }
  return (
    <form className="perf-form perf-recovery-editor" onSubmit={submit}>
      <p className="eyebrow">YOUR PRACTICE / {draft.day}</p>
      <h2 tabIndex={-1}>{past ? 'How did it go?' : 'Choose one thing you can keep.'}</h2>
      {past ? (
        <>
          <p>
            {recoveryActions[draft.action]} · {draft.minutes} minutes
            {draft.cue ? ` · ${draft.cue}` : ''}
          </p>
          <fieldset className="perf-recovery-options" disabled={busy}>
            <legend>Follow-through</legend>
            {(['done', 'partial', 'skipped'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={draft.outcome === v}
                onClick={() => setDraft({ ...draft, outcome: v })}
              >
                {recoveryOutcomes[v]}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={draft.outcome === null}
              onClick={() => setDraft({ ...draft, outcome: null })}
            >
              Not recorded
            </button>
          </fieldset>
          <p className="perf-caption">
            Your original plan stays fixed. This updates only what you report doing.
          </p>
        </>
      ) : (
        <>
          <fieldset className="perf-recovery-options" disabled={busy}>
            <legend>Recovery practice</legend>
            {(Object.keys(recoveryActions) as RecoveryRoutine['action'][]).map((v) => (
              <button
                type="button"
                key={v}
                aria-pressed={draft.action === v}
                onClick={() => setDraft({ ...draft, action: v })}
              >
                {recoveryActions[v]}
              </button>
            ))}
          </fieldset>
          <label>
            Minutes to set aside
            <input
              type="number"
              min="5"
              max="60"
              step="1"
              disabled={busy}
              value={draft.minutes}
              onChange={(e) => setDraft({ ...draft, minutes: e.target.valueAsNumber })}
            />
          </label>
          <label>
            Your cue · optional
            <input
              maxLength={120}
              disabled={busy}
              placeholder="After my shift, before my next sleep"
              value={draft.cue}
              onChange={(e) => setDraft({ ...draft, cue: e.target.value })}
            />
          </label>
          <p className="perf-caption">
            Choose a comfortable practice. This sets an intention; it does not change your training
            plan or start a reminder.
          </p>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="perf-inline">
        <button className="perf-primary" disabled={busy}>
          {past ? 'Save follow-through' : 'Save practice'}
        </button>
        <button type="button" disabled={busy} onClick={close}>
          Cancel
        </button>
      </div>
    </form>
  );
}
