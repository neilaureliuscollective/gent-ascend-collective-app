'use client';
import { useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { dayLabel } from '@/domains/daily/model';
import {
  emptyArrival,
  type Arrival,
  type CommandData,
  type DailyCommandOutcome,
} from '@/domains/daily-command/model';
import './command.css';
export function DailyCommandWorkspace({ initial }: { initial: CommandData }) {
  const [data, setData] = useState(initial);
  const [arrival, setArrival] = useState(data.arrival);
  const [outcome, setOutcome] = useState<DailyCommandOutcome>(
    data.record?.outcome ?? {
      decisions:
        data.record?.snapshot.decisions.map((d) => ({ id: d.id, result: 'unknown' })) ?? [],
      fit: null,
      tomorrow: '',
    },
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [stale, setStale] = useState(false);
  const lock = useRef(false);
  const snapshot = data.snapshot;
  async function reload() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const response = await fetch('/api/daily-command', {
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error);
      if (value.ownerId !== data.ownerId)
        throw new Error('Your account changed. Reopen Daily Command.');
      setData(value);
      setArrival(value.arrival);
      setOutcome(
        value.record?.outcome ?? {
          decisions:
            value.record?.snapshot.decisions.map((d: { id: string }) => ({
              id: d.id,
              result: 'unknown',
            })) ?? [],
          fit: null,
          tomorrow: '',
        },
      );
      setStale(false);
      setError('');
      setNotice('Loaded your saved command.');
    } catch {
      setError('Your records could not be reloaded. Your draft remains here.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function save(kind: 'arrival' | 'outcome', event?: FormEvent, keepExisting = false) {
    event?.preventDefault();
    if (lock.current || stale || !snapshot) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const body = {
        kind,
        ownerId: data.ownerId,
        requestId: crypto.randomUUID(),
        day: snapshot.day,
        version: data.record?.version ?? 0,
        ...(kind === 'arrival' ? { arrival: keepExisting ? data.arrival : arrival } : { outcome }),
      };
      const response = await fetch('/api/daily-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error);
      setData(value);
      setArrival(value.arrival);
      setOutcome(
        value.record?.outcome ?? {
          decisions: value.record.snapshot.decisions.map((d: { id: string }) => ({
            id: d.id,
            result: 'unknown',
          })),
          fit: null,
          tomorrow: '',
        },
      );
      setNotice(
        kind === 'arrival'
          ? 'Your arrival and command are saved.'
          : 'Your feedback is saved for tomorrow.',
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Save could not be confirmed.');
      setStale(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (!snapshot)
    return (
      <section className="daily-command">
        <p className="eyebrow">ASCEND DAILY COMMAND</p>
        <h1>Your day is waiting.</h1>
        <p>{data.error ?? 'Sign in to connect your day.'}</p>
        <Link className="button" href="/app">
          Return to Command
        </Link>
      </section>
    );
  const numberField = (
    key: 'sleepMinutes' | 'energy' | 'minutes',
    label: string,
    min: number,
    max: number,
  ) => (
    <label>
      {label}
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step="1"
        value={arrival[key] ?? ''}
        placeholder="Unknown"
        onChange={(e) =>
          setArrival({ ...arrival, [key]: e.target.value === '' ? null : Number(e.target.value) })
        }
      />
    </label>
  );
  const selectField = (key: 'soreness' | 'bandwidth', label: string, options: string[]) => (
    <label>
      {label}
      <select
        aria-label={label}
        value={arrival[key] ?? ''}
        onChange={(e) =>
          setArrival({ ...arrival, [key]: (e.target.value || null) as Arrival[typeof key] })
        }
      >
        <option value="">Use recorded context / unknown</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <section className="daily-command" aria-label="Daily Command">
      <header className="command-arrival">
        <p className="eyebrow">TODAY / {dayLabel(snapshot.day, true)}</p>
        <h1>{snapshot.state}</h1>
        <p className="command-reason">{snapshot.reason}</p>
        <span className="command-confidence">
          {snapshot.confidence.level} context · {snapshot.confidence.known}/3 arrival signals
        </span>
        <div className="command-tools">
          <a href="#command-checkin">How are you arriving? ↗</a>
          <button type="button" onClick={() => void reload()} disabled={busy}>
            Refresh context
          </button>
        </div>
      </header>
      {snapshot.unavailable.length > 0 && (
        <p role="status">
          Some context is unavailable: {snapshot.unavailable.join(', ')}. These signals are treated
          as unknown.
        </p>
      )}
      <ol className="command-decisions">
        {snapshot.decisions.map((d, i) => (
          <li key={d.id}>
            <Link href={d.href}>
              <span className="command-index">0{i + 1}</span>
              <span>
                <strong>{d.label}</strong>
                <p>{d.detail}</p>
              </span>
              <span aria-hidden="true">↗</span>
            </Link>
          </li>
        ))}
      </ol>
      {!data.record && (
        <button
          className="button"
          type="button"
          disabled={busy || stale}
          onClick={() => void save('arrival', undefined, true)}
        >
          Keep this command
        </button>
      )}
      <p className="command-interpretation">{snapshot.interpretation}</p>
      <p className="command-footnote">
        Rule-based interpretation · Recommendations leave your plans unchanged.
      </p>
      <details className="command-disclosure">
        <summary>Why this direction</summary>
        <p>{snapshot.reason}</p>
        <p>
          Confidence describes completeness, not scientific certainty. Unknown:{' '}
          {snapshot.confidence.missing.join(', ') || 'none of the three recovery arrival signals'}.
        </p>
        <ul>
          {snapshot.signals.map((s, i) => (
            <li key={i}>
              <small>
                {s.source === 'app-history' ? 'APP HISTORY' : 'USER-REPORTED'} / {s.day}
              </small>
              <p>{s.detail}</p>
            </li>
          ))}
        </ul>
        {snapshot.decisions.map((d) => (
          <p key={d.id}>
            <strong>{d.label} · </strong>
            {d.reason}
          </p>
        ))}
        <p>
          INFERRED / RECOMMENDED · {snapshot.state} is a conservative product heuristic, not a
          clinical measurement.
        </p>
      </details>
      <details className="command-disclosure">
        <summary>Talk to Aethelios about this day</summary>
        <p>
          Open an editable draft from your latest saved reports and current suggestions. Review or
          remove details before sending. Nothing is added to memory.
        </p>
        <Link className="button" href="/app/aethelios?starter=command">
          Review my day with Aethelios ↗
        </Link>
      </details>
      <details className="command-disclosure" id="command-checkin">
        <summary>Morning arrival · optional</summary>
        <p>
          Leave fields blank to use today’s existing reports. Missing reports stay unknown. Explicit
          arrival values take priority for this day.
        </p>
        <form onSubmit={(e) => void save('arrival', e)}>
          <fieldset disabled={busy || stale}>
            <div className="command-fields">
              {numberField('sleepMinutes', 'Sleep · minutes', 0, 1440)}
              {numberField('energy', 'Energy · 1 very low to 5 high', 1, 5)}
              {selectField('soreness', 'Soreness', ['none', 'mild', 'high'])}
              {selectField('bandwidth', 'Mental bandwidth', ['limited', 'steady', 'open'])}
              {numberField('minutes', 'Available training time · minutes', 5, 240)}
            </div>
            {data.record?.outcome && (
              <p>
                Saving a new arrival begins a revised command. Earlier feedback remains in history.
              </p>
            )}
            <button className="button" type="submit">
              {busy ? 'Saving…' : 'Save arrival & command'}
            </button>
            <button type="button" onClick={() => setArrival(emptyArrival)}>
              Use existing reports
            </button>
          </fieldset>
        </form>
      </details>
      <details className="command-disclosure">
        <summary>Close the loop</summary>
        {!data.record ? (
          <p>
            Save your arrival and command first, even with blank inputs. This keeps the decisions
            you are reviewing.
          </p>
        ) : (
          <form onSubmit={(e) => void save('outcome', e)}>
            <p>
              Review the saved command from version {data.record.version}. Refreshed suggestions
              above may differ. Feedback records your account; it does not mark workouts or rituals
              complete.
            </p>
            <fieldset disabled={busy || stale}>
              {data.record.snapshot.decisions.map((d) => (
                <label key={d.id}>
                  {d.label} · {d.detail}
                  <select
                    value={outcome.decisions.find((x) => x.id === d.id)?.result ?? 'unknown'}
                    onChange={(e) =>
                      setOutcome({
                        ...outcome,
                        decisions: [
                          ...outcome.decisions.filter((x) => x.id !== d.id),
                          {
                            id: d.id,
                            result: e.target.value as 'done' | 'partial' | 'skipped' | 'unknown',
                          },
                        ],
                      })
                    }
                  >
                    <option value="unknown">Not recorded</option>
                    <option value="done">Done</option>
                    <option value="partial">Partly</option>
                    <option value="skipped">Skipped</option>
                  </select>
                </label>
              ))}
              <label>
                Did the direction fit?
                <select
                  value={outcome.fit ?? ''}
                  onChange={(e) =>
                    setOutcome({
                      ...outcome,
                      fit: (e.target.value || null) as DailyCommandOutcome['fit'],
                    })
                  }
                >
                  <option value="">Not sure yet</option>
                  <option value="right">About right</option>
                  <option value="too-much">Too much</option>
                  <option value="too-light">Too light</option>
                  <option value="unsure">Unsure</option>
                </select>
              </label>
              <label>
                What should tomorrow know?
                <textarea
                  rows={3}
                  maxLength={240}
                  value={outcome.tomorrow}
                  onChange={(e) => setOutcome({ ...outcome, tomorrow: e.target.value })}
                />
              </label>
              <button className="button" type="submit">
                Save evening feedback
              </button>
            </fieldset>
          </form>
        )}
      </details>
      {data.yesterday && (
        <p className="command-carry">
          Yesterday’s feedback: {data.yesterday.outcome.fit ?? 'fit not recorded'}
          {data.yesterday.outcome.tomorrow ? ` · ${data.yesterday.outcome.tomorrow}` : ''}
        </p>
      )}
      {error && (
        <p role="alert">
          {error}{' '}
          {stale && (
            <button onClick={() => void reload()} disabled={busy}>
              Reload saved command (discard draft)
            </button>
          )}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <footer className="command-footer">
        <Link href="/app/daily">Intentions, actions & evening review ↗</Link>
        <Link href="/experience/world">Enter your world ↗</Link>
      </footer>
    </section>
  );
}
