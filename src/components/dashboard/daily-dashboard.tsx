'use client';
import { useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { OrbitSignature } from '@/components/visual/orbit-signature';
import { AureliusPresence } from '@/components/visual/aurelius-presence';
import { Icon } from '@/components/visual/icon';
import {
  dayLabel,
  emptyDay,
  sampleData,
  energyLabels,
  type DailyData,
  type DayEntry,
} from '@/domains/daily/model';
import { Rhythm } from './rhythm';
type Editor = 'checkin' | 'action' | 'reflection';
export function DailyDashboard({ initial }: { initial: DailyData }) {
  const [data, setData] = useState(initial);
  const [lens, setLens] = useState<'today' | 'evening'>('today');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editor, setEditor] = useState<Editor>('checkin');
  const day = data.entries.find((e) => e.day === data.today) ?? emptyDay(data.today, data.timezone);
  const [draft, setDraft] = useState<DayEntry>(day);
  const [actionTitle, setActionTitle] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [needsReload, setNeedsReload] = useState(false);
  const lock = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const focusReturn = useRef<HTMLElement | null>(null);
  const preview = data.mode === 'preview',
    sample = data.mode === 'sample';
  const done = day.actions.filter((a) => a.done).length;
  const open = (kind: Editor) => {
    setEditorOpen(true);
    setEditor(kind);
    setDraft(structuredClone(day));
    setActionTitle('');
    focusReturn.current = document.activeElement as HTMLElement;
    dialog.current?.showModal();
  };
  function switchMode(next: DailyData) {
    setData(next);
    setNotice('');
    setError('');
    setNeedsReload(false);
    dialog.current?.close();
  }
  async function save(next: DayEntry, close = true) {
    if (lock.current || needsReload || preview) return;
    lock.current = true;
    setBusy(true);
    try {
      const { daySchema } = await import('@/domains/daily/schema');
      const checked = daySchema.safeParse(next);
      if (!checked.success) {
        setError('Review your entries before saving.');
        return;
      }
      setError('');
      setNotice('');
      if (sample) {
        setData({
          ...data,
          entries: [
            ...data.entries.filter((e) => e.day !== next.day),
            { ...next, version: next.version + 1, updated_at: new Date().toISOString() },
          ],
        });
        setNotice('Sample updated. Nothing was saved to an account.');
        if (close) dialog.current?.close();
        return;
      }
      const response = await fetch('/api/daily', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checked.data),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Your day could not be saved.');
      setData(result as DailyData);
      setNotice('Your day is saved.');
      if (close) dialog.current?.close();
    } catch (caught) {
      setError(
        caught instanceof Error && caught.name !== 'TimeoutError'
          ? caught.message
          : 'We could not confirm the save. Your draft is still here. Reload the saved day before retrying.',
      );
      setNeedsReload(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function reload() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const response = await fetch('/api/daily', {
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Reload failed.');
      setData(result as DailyData);
      setNeedsReload(false);
      setError('');
      setNotice('Loaded your saved day.');
      dialog.current?.close();
    } catch {
      setError(
        'Your saved day could not be loaded. Your draft remains here. Try again when connected.',
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const next =
      editor === 'action'
        ? {
            ...draft,
            actions: [
              ...draft.actions,
              { id: crypto.randomUUID(), title: actionTitle.trim(), done: false },
            ],
          }
        : draft;
    void save(next);
  }
  const feedback = (
    <>
      {error && (
        <div className="daily-error" role="alert">
          <p>{error}</p>
          {needsReload && (
            <button
              className="text-button"
              type="button"
              disabled={busy}
              onClick={() => void reload()}
            >
              Reload saved day (discard draft)
            </button>
          )}
        </div>
      )}
    </>
  );
  return (
    <div className="daily-dashboard">
      <header className="daily-heading">
        <div>
          <p className="eyebrow">
            YOUR DAILY SPACE <span> / </span> {dayLabel(data.today, true)}
          </p>
          <h1>
            {sample
              ? 'A day with intention.'
              : data.name
                ? `Your day, ${data.name}.`
                : 'Make today yours.'}
          </h1>
          <p>Your standards. Your direction. Your next step.</p>
        </div>
        <div className="daily-heading-tools">
          <div className="segmented" aria-label="Dashboard perspective">
            <button aria-pressed={lens === 'today'} onClick={() => setLens('today')}>
              <Icon name="sun" />
              Today
            </button>
            <button aria-pressed={lens === 'evening'} onClick={() => setLens('evening')}>
              <Icon name="moon" />
              Evening
            </button>
          </div>
          {!data.name && !sample && (
            <button className="text-button" onClick={() => switchMode(sampleData(data.today))}>
              Explore a sample day <span aria-hidden="true">↗</span>
            </button>
          )}
        </div>
      </header>
      {sample ? (
        <div className="daily-mode-bar">
          <span>
            <strong>Sample experience</strong> · Fictional records. Changes last only in this view.
          </span>
          <button onClick={() => switchMode(initial)}>Exit sample</button>
        </div>
      ) : preview ? (
        <div className="daily-mode-bar quiet">
          <span>Your daily space is ready to explore. Sign in to save personal records.</span>
          <Link href="/you">
            Your account <Icon name="arrow" />
          </Link>
        </div>
      ) : (
        <p className="daily-timezone">
          Today in {data.timezone.replaceAll('_', ' ')} · User-entered observations
        </p>
      )}
      <p className="daily-notice" role="status" data-saved={!!notice && !busy}>
        {busy ? (sample ? 'Updating sample…' : 'Saving your day…') : notice}
      </p>
      {!editorOpen && feedback}
      {!sample && !preview && (data.carryForward || data.openCaptures) && <aside className="loop-context" aria-label="Context carried into today">
        <span className="eyebrow">CARRIED INTO TODAY</span>
        {data.carryForward?.reflection && <p>From {dayLabel(data.carryForward.day, true)}: {data.carryForward.reflection}</p>}
        {!!data.carryForward?.unfinished.length && <p>{data.carryForward.unfinished.length} unfinished {data.carryForward.unfinished.length === 1 ? 'action' : 'actions'} from {dayLabel(data.carryForward.day, true)}. Choose deliberately what still matters.</p>}
        {!!data.openCaptures && <Link href="/captures">{data.openCaptures} {data.openCaptures === 1 ? 'thought' : 'thoughts'} waiting in Capture →</Link>}
      </aside>}
      <div className="daily-top-grid">
        <section className="daily-orientation" aria-labelledby="orientation-title">
          <OrbitSignature />
          <div className="orientation-top">
            <span className="eyebrow">
              {lens === 'today' ? 'YOUR DIRECTION TODAY' : 'A MOMENT TO REFLECT'}
            </span>
            <span className="tag">{day.intention ? 'IN YOUR WORDS' : 'GENT ASCEND'}</span>
          </div>
          <div className="orientation-content">
            <div>
              <h2 id="orientation-title">
                {lens === 'evening'
                  ? 'Let the day settle.'
                  : day.intention || (
                      <>
                        Begin with clarity.
                        <br />
                        <em>Move with intention.</em>
                      </>
                    )}
              </h2>
              <p>
                {lens === 'evening'
                  ? 'Keep what mattered. Notice what you learned. Tomorrow can begin from there.'
                  : day.intention
                    ? 'A direction you chose. Let the next small action support it.'
                    : 'Choose what deserves your attention. Build the day around it.'}
              </p>
            </div>
            <AureliusPresence className="daily-presence" />
          </div>
          <div className="orientation-bottom">
            <button
              className="button"
              onClick={() => open(lens === 'today' ? 'checkin' : 'reflection')}
            >
              {lens === 'today'
                ? day.intention
                  ? 'Refine your intention'
                  : 'Set your intention'
                : 'Reflect on today'}
              <Icon name="arrow" />
            </button>
            <Link
              href={`/aethelios?starter=${lens === 'today' ? 'plan' : 'reflect'}`}
              className="orientation-link"
            >
              {lens === 'today' ? 'Plan with Aethelios' : 'Reflect with Aethelios'}{' '}
              <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <p className="orientation-source">
            {sample
              ? 'Sample day · no AI assessment'
              : day.intention
                ? 'Your intention · no AI assessment'
                : 'Your daily orientation · no AI assessment'}
          </p>
        </section>
        <section className="daily-card checkin-card">
          <div className="daily-card-heading">
            <div>
              <p className="eyebrow">PAUSE & NOTICE</p>
              <h2>How are you arriving?</h2>
            </div>
            <Icon name="sun" />
          </div>
          <p className="daily-card-copy">Your own perspective belongs beside the numbers.</p>
          <div className="checkin-values">
            <div>
              <span>ENERGY</span>
              <strong>
                {day.energy ?? '—'}
                <small> / 5</small>
              </strong>
              <p>{day.energy ? energyLabels[day.energy - 1] : 'Not checked in'}</p>
              <div className="energy-pips" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((n) => (
                  <i key={n} className={day.energy != null && n <= day.energy ? 'lit' : ''} />
                ))}
              </div>
            </div>
            <div>
              <span>SLEEP</span>
              <strong>
                {day.sleep_minutes != null ? Math.floor(day.sleep_minutes / 60) : '—'}
                <small>
                  {' '}
                  h{' '}
                  {day.sleep_minutes != null && day.sleep_minutes % 60
                    ? `${day.sleep_minutes % 60}m`
                    : ''}
                </small>
              </strong>
              <p>{day.sleep_minutes != null ? 'Entered by you' : 'Not recorded'}</p>
              <span className="manual-label">SELF-REPORTED</span>
            </div>
          </div>
          <button className="checkin-button" onClick={() => open('checkin')}>
            {day.energy != null || day.sleep_minutes != null
              ? 'Update your check-in'
              : 'Take a moment to check in'}
            <Icon name="arrow" />
          </button>
        </section>
      </div>
      <div className="daily-main-grid">
        <section className="daily-card actions-card">
          <div className="daily-card-heading">
            <div>
              <p className="eyebrow">SMALL STEPS. REAL INTENT.</p>
              <h2>Make room for progress.</h2>
            </div>
            <span className="daily-count">
              {done}
              <span> / {day.actions.length}</span>
            </span>
          </div>
          <p className="daily-card-copy">
            A few things worth doing. Enough space to actually do them.
          </p>
          <div
            className="action-progress"
            role="img"
            aria-label={`${done} of ${day.actions.length} actions complete`}
          >
            <span
              style={{ width: `${day.actions.length ? (done / day.actions.length) * 100 : 0}%` }}
            />
          </div>
          <ul className="daily-actions">
            {day.actions.map((action) => (
              <li key={action.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={action.done}
                    disabled={busy || needsReload || preview}
                    onChange={() =>
                      void save(
                        {
                          ...day,
                          actions: day.actions.map((a) =>
                            a.id === action.id ? { ...a, done: !a.done } : a,
                          ),
                        },
                        false,
                      )
                    }
                  />
                  <span className={action.done ? 'action-done' : ''}>{action.title}</span>
                </label>
                <button
                  className="remove-action"
                  aria-label={`Remove action: ${action.title}`}
                  disabled={busy || needsReload || preview}
                  onClick={() =>
                    void save(
                      { ...day, actions: day.actions.filter((a) => a.id !== action.id) },
                      false,
                    )
                  }
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          {!day.actions.length && (
            <div className="daily-actions-empty">
              <Icon name="progress" />
              <p>
                What would make today meaningful?
                <br />
                <span>Start with one action you can actually take.</span>
              </p>
            </div>
          )}
          <button
            className="add-daily-action"
            disabled={busy || needsReload || day.actions.length >= 5}
            onClick={() => open('action')}
          >
            +{' '}
            {day.actions.length >= 5 ? 'Five is enough for this space' : 'Add a deliberate action'}
          </button>
          {day.actions.length > 0 && done === day.actions.length && (
            <p className="completion-note">
              You followed through on what you chose. Leave some room for the rest of life.
            </p>
          )}
        </section>
        <div className="daily-side-stack">
          <section className="daily-card goal-daily-card">
            <p className="eyebrow">THE BIGGER DIRECTION</p>
            <h2>{data.goal?.title || 'What are you building toward?'}</h2>
            <p>
              {data.goal?.next_step || 'Give your daily steps something meaningful to support.'}
            </p>
            <Link className="card-action" href="/goals">
              {data.goal ? 'Open your goal' : 'Choose your direction'}
              <Icon name="arrow" />
            </Link>
          </section>
          <section className="daily-continuity">
            <AureliusPresence />
            <div>
              <p className="eyebrow">PICK UP THE THREAD</p>
              <h3>{data.conversation?.title || 'A considered perspective.'}</h3>
              <Link
                href={
                  data.conversation
                    ? `/aethelios?conversation=${data.conversation.id}`
                    : '/aethelios?starter=perspective'
                }
              >
                {data.conversation ? 'Continue your conversation' : 'Think with Aethelios'}{' '}
                <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </section>
        </div>
      </div>
      <div className="daily-bottom-grid">
        <Rhythm today={data.today} entries={data.entries} />
        <section
          className={`daily-card reflection-card ${lens === 'evening' ? 'reflection-active' : ''}`}
        >
          <div className="reflection-symbol" aria-hidden="true">
            ✦
          </div>
          <p className="eyebrow">CLOSE THE DAY WELL</p>
          <h2>
            Keep the part
            <br />
            that matters.
          </h2>
          <p>
            {day.reflection || 'A small win. A lesson. Something you want to carry into tomorrow.'}
          </p>
          <button className="secondary-button" onClick={() => open('reflection')}>
            {day.reflection ? 'Edit your reflection' : 'Leave a reflection'}
            <Icon name="arrow" />
          </button>
          <span className="reflection-note">
            {sample
              ? 'Sample only · never saved'
              : preview
                ? 'Personal reflections require sign-in'
                : 'Private to your account · not added to AI memory'}
          </span>
        </section>
      </div>
      <footer className="daily-footer">
        <div>
          <p className="eyebrow">YOUR LIFE, CONNECTED</p>
          <p>More of your world. At your pace.</p>
        </div>
        <nav aria-label="Explore your personal world">
          <Link href="/world">
            My world <Icon name="arrow" />
          </Link>
          <Link href="/you">
            Personal context <Icon name="arrow" />
          </Link>
        </nav>
      </footer>
      <details className="daily-data-note">
        <summary>Where this information comes from</summary>
        <p>
          Energy and sleep here are your own reports. Actions, intentions and reflections are
          entered by you. Missing entries remain blank. Wearables, automatic recovery scores, labs
          and body measurements are not connected to this dashboard. Your three most recent daily
          entries are included only when you choose personal context in an Aethelios conversation.
        </p>
      </details>
      <dialog
        className="daily-editor"
        ref={dialog}
        aria-labelledby="daily-editor-title"
        onCancel={(event) => {
          if (busy) event.preventDefault();
        }}
        onClose={() => {
          setEditorOpen(false);
          focusReturn.current?.focus();
        }}
      >
        <div className="daily-editor-top">
          <p className="eyebrow">{sample ? 'SAMPLE DAY' : dayLabel(data.today, true)}</p>
          <button
            aria-label="Close daily editor"
            disabled={busy}
            onClick={() => dialog.current?.close()}
          >
            ×
          </button>
        </div>
        <h2 id="daily-editor-title">
          {editor === 'checkin'
            ? 'A moment for yourself.'
            : editor === 'action'
              ? 'Choose your next step.'
              : 'What stays with you?'}
        </h2>
        {preview ? (
          <div className="daily-editor-preview">
            <p>Sign in to save your day, or try the sample experience with fictional records.</p>
            <button className="button" onClick={() => switchMode(sampleData(data.today))}>
              Try the sample day
            </button>
            <Link href="/you">Your account →</Link>
          </div>
        ) : (
          <form onSubmit={submit} aria-label="Daily editor">
            <fieldset disabled={busy} className="daily-editor-fields">
              {editor === 'checkin' ? (
                <>
                  <label htmlFor="day-intention">What matters most today?</label>
                  <input
                    id="day-intention"
                    maxLength={160}
                    value={draft.intention}
                    onChange={(e) => setDraft({ ...draft, intention: e.target.value })}
                    placeholder="One direction worth choosing"
                  />
                  <fieldset className="energy-input">
                    <legend>
                      How is your energy? <span>Optional</span>
                    </legend>
                    <div>
                      {energyLabels.map((label, i) => (
                        <button
                          type="button"
                          key={label}
                          aria-pressed={draft.energy === i + 1}
                          onClick={() =>
                            setDraft({ ...draft, energy: draft.energy === i + 1 ? null : i + 1 })
                          }
                        >
                          <strong>{i + 1}</strong>
                          {label}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <label htmlFor="day-sleep">
                    Hours slept <span className="muted">(optional, entered by you)</span>
                  </label>
                  <input
                    id="day-sleep"
                    type="number"
                    min="0"
                    max="24"
                    step="0.25"
                    value={draft.sleep_minutes == null ? '' : draft.sleep_minutes / 60}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        sleep_minutes:
                          e.target.value === '' ? null : Math.round(Number(e.target.value) * 60),
                      })
                    }
                    placeholder="e.g. 7.5"
                  />
                </>
              ) : editor === 'action' ? (
                <>
                  <label htmlFor="day-action">One action you can take</label>
                  <input
                    id="day-action"
                    required
                    maxLength={100}
                    value={actionTitle}
                    onChange={(e) => setActionTitle(e.target.value)}
                    placeholder="Keep it specific and manageable"
                  />
                  <p className="daily-editor-help">
                    Up to five actions. Completing one does not complete your larger goal.
                  </p>
                </>
              ) : (
                <>
                  <label htmlFor="day-reflection">A win, a lesson, or something to remember</label>
                  <textarea
                    id="day-reflection"
                    rows={5}
                    maxLength={500}
                    value={draft.reflection}
                    onChange={(e) => setDraft({ ...draft, reflection: e.target.value })}
                    placeholder="No perfect answer required."
                  />
                  <p className="daily-editor-help">
                    Saved in your daily record. Nothing is automatically promoted to Aethelios
                    memory.
                  </p>
                </>
              )}
            </fieldset>
            {feedback}
            <button
              className="button"
              type="submit"
              disabled={busy || needsReload || (editor === 'action' && !actionTitle.trim())}
            >
              {busy ? 'Saving…' : sample ? 'Apply to sample' : 'Save your day'}
              <Icon name="arrow" />
            </button>
          </form>
        )}
      </dialog>
    </div>
  );
}
