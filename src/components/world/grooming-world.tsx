'use client';
import { track } from '@/domains/onboarding/track';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { RitualEditor } from '@/components/grooming/ritual-editor';
import { feedbackChoices, ritualSteps, practiceSummary } from '@/domains/grooming/ritual-model';
import { ContextSheet } from '@/components/interaction/context-sheet';
import { dayLabel, localDay } from '@/domains/daily/model';
import {
  groomingAreas,
  groomingWorldSnapshot,
  practiceReceipt,
  type GroomingWorldSnapshot,
  type WorldRitual,
} from '@/domains/grooming/world-model';
import { useWorldAtmosphere } from './world-atmosphere';
const sample: WorldRitual = {
  id: '65000000-0000-4000-8000-000000000001',
  kind: 'morning',
  title: 'A deliberate start',
  steps:
    'Choose the look you want to maintain today.\nFollow the familiar hair, beard or skin routine that already works for you.\nNotice one detail you want to keep or discuss with your professional.',
  version: 1,
  lastRecordedAt: null,
  products: [],
  productCount: 0,
};

export function GroomingWorld({
  embedded = false,
  initialData,
  suggestion,
}: {
  embedded?: boolean;
  initialData?: GroomingWorldSnapshot;
  suggestion?: {
    kind: 'morning' | 'evening' | 'weekly';
    title: string;
    steps: string;
    reason: string;
    sourceTurnId: string;
  } | null;
}) {
  const params = useSearchParams();
  const selected = Math.max(
    0,
    groomingAreas.findIndex((a) => a.id === params.get('area')),
  );
  const area = groomingAreas[selected]!;
  const [data, setData] = useState<GroomingWorldSnapshot | null>(initialData ?? null),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0);
  const [kind, setKind] = useState<'morning' | 'evening' | 'weekly' | null>(
    suggestion?.kind ?? null,
  );
  const [practice, setPractice] = useState(false),
    [busy, setBusy] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(suggestion);
  const [editing, setEditing] = useState(!!suggestion),
    [quick, setQuick] = useState(0),
    [reviewWeek, setReviewWeek] = useState(false);
  const effectiveKind = kind ?? (data?.mode === 'personal' ? data.suggestedKind : 'morning');
  const { ref, solid, saveData } = useWorldAtmosphere();
  useEffect(() => {
    if (initialData && revision === 0) return;
    const abort = new AbortController();
    void fetch('/api/world/grooming', {
      cache: 'no-store',
      signal: AbortSignal.any([abort.signal, AbortSignal.timeout(12000)]),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const next = groomingWorldSnapshot.parse(await response.json());
        if (!abort.signal.aborted) {
          setData(next);
          setError('');
        }
      })
      .catch(() => {
        if (!abort.signal.aborted)
          setError(
            'Your saved rituals are unavailable right now. You can still explore your Grooming world.',
          );
      });
    return () => abort.abort();
  }, [revision, initialData]);
  const ritual =
    data?.mode === 'personal'
      ? data.rituals.find((r) => r.kind === effectiveKind)
      : data?.mode === 'guest'
        ? sample
        : undefined;
  const today = data?.mode === 'personal' ? data.day : null;
  const summary = practiceSummary(data?.mode === 'personal' ? data.week : []);
  const recordedToday = !!(
    data?.mode === 'personal' &&
    ritual?.lastRecordedAt &&
    localDay(new Date(ritual.lastRecordedAt), data.timezone) === today
  );
  function choose(index: number) {
    const url = new URL(location.href);
    url.searchParams.set('area', groomingAreas[index]!.id);
    history.replaceState(null, '', url);
  }
  function recorded(occurredAt: string) {
    setRevision((r) => r + 1);
    setData((current) =>
      current?.mode === 'personal'
        ? {
            ...current,
            rituals: current.rituals.map((r) =>
              r.id === ritual?.id ? { ...r, lastRecordedAt: occurredAt } : r,
            ),
          }
        : current,
    );
  }
  return (
    <>
      <section
        className={`gw-grooming ritual-chamber${embedded ? ' ritual-chamber-member' : ''}`}
        ref={ref}
        data-solid={solid}
        data-save-data={saveData}
        aria-labelledby="grooming-world-heading"
      >
        <Link
          className="gw-grooming-return"
          href={embedded ? '/app/presence' : '/experience/world?world=grooming'}
        >
          {embedded ? '← Presence' : '← Whole-Man World'}
        </Link>
        <div className="gw-grooming-intro">
          <p className="gw-kicker">PRESENCE / GROOMING</p>
          <h1 id="grooming-world-heading" tabIndex={-1}>
            Your standard.
            <br />
            <em>On your terms.</em>
          </h1>
          <p>Hair, beard and skin. Your direction, at your own pace.</p>
        </div>
        <div className="gw-grooming-mirror" aria-hidden="true">
          <Image
            src="/media/world/ritual-mirror-v1.webp"
            alt=""
            fill
            sizes="(max-width: 900px) 100vw, 50vw"
            preload
          />
          <div className="gw-mirror-shade" />
          <div className="gw-mirror-orbit" />
          <span className="gw-mirror-caption">THE STANDARD IS PERSONAL</span>
        </div>
        <div className="gw-grooming-controls">
          <div className="gw-grooming-areas" role="group" aria-label="Grooming areas">
            {groomingAreas.map((item, index) => (
              <button
                key={item.id}
                aria-pressed={index === selected}
                aria-controls="grooming-area"
                onClick={() => choose(index)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <section id="grooming-area" className="gw-grooming-detail" aria-label={area.label}>
            <p className="gw-kicker">
              {area.id === 'ritual' && ritual
                ? data?.mode === 'guest'
                  ? 'SAMPLE PRACTICE'
                  : `${effectiveKind.toUpperCase()} / YOUR RITUAL`
                : area.eyebrow}
            </p>
            <h2>{area.id === 'ritual' && ritual ? ritual.title : area.title}</h2>
            {area.id !== 'ritual' && <p>{area.description}</p>}
            {area.id === 'ritual' ? (
              <>
                {data?.mode === 'personal' && (
                  <div className="gw-ritual-kinds" role="group" aria-label="Choose ritual time">
                    {(['morning', 'evening', 'weekly'] as const).map((value) => (
                      <button
                        key={value}
                        aria-pressed={effectiveKind === value}
                        onClick={() => {
                          setKind(value);
                          setQuick(0);
                        }}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                )}
                {ritual ? (
                  <>
                    <details className="ritual-glance">
                      <summary>
                        {ritualSteps(ritual.steps).length} steps · {ritual.productCount} linked
                        products
                      </summary>
                      <ol>
                        {ritualSteps(ritual.steps).map((text, index) => (
                          <li key={index}>{text}</li>
                        ))}
                      </ol>
                    </details>
                    <button
                      className="gw-action"
                      onClick={() => {
                        setQuick(0);
                        setPractice(true);
                      }}
                      aria-haspopup="dialog"
                    >
                      {data?.mode === 'guest'
                        ? 'Explore a ritual'
                        : recordedToday
                          ? 'Review your ritual'
                          : 'Review your routine'}{' '}
                      <span aria-hidden="true">↗</span>
                    </button>
                    {data?.mode === 'personal' && !recordedToday && (
                      <button
                        className="ritual-quick-action"
                        disabled={busy}
                        onClick={() => {
                          setQuick((q) => q + 1);
                          setPractice(true);
                        }}
                      >
                        Add a practice note
                      </button>
                    )}
                    {data?.mode === 'personal' && (
                      <p className="ritual-time-note">
                        {kind === null
                          ? 'Suggested from your local time. Switch whenever you need.'
                          : 'Your selected ritual.'}
                      </p>
                    )}
                    <p className="gw-muted">
                      {data?.mode === 'guest'
                        ? 'Try the flow. Sample progress stays in this view.'
                        : ritual.lastRecordedAt
                          ? `Last recorded ${dayLabel(localDay(new Date(ritual.lastRecordedAt), data?.mode === 'personal' ? data.timezone : 'UTC'), true)} · Your record`
                          : 'Your saved steps. Your own pace.'}
                    </p>
                  </>
                ) : data?.mode === 'personal' ? (
                  <>
                    <p className="gw-ritual-empty">
                      Your {effectiveKind} ritual is ready to take shape.
                    </p>
                    <button className="gw-action" onClick={() => setEditing(true)}>
                      Create your ritual ↗
                    </button>
                  </>
                ) : !error ? (
                  <p className="gw-muted" role="status">
                    Loading your rituals…
                  </p>
                ) : null}
                {error && (
                  <div className="gw-grooming-error" role="alert">
                    <p>{error}</p>
                    <button onClick={() => setRevision((r) => r + 1)}>Try loading again</button>
                  </div>
                )}
              </>
            ) : (
              <>
                <Link className="gw-action" href={area.href} prefetch={false}>
                  {area.action} ↗
                </Link>
                <p className="gw-muted">{area.note}</p>
              </>
            )}
          </section>
          <div className="gw-grooming-links">
            {embedded ? (
              <a href="#ritual-history">Your full Concierge ↗</a>
            ) : (
              <Link href="/app/grooming">Your full Concierge ↗</Link>
            )}
            <Link href="/app/aethelios?starter=grooming">Ask Aethelios ↗</Link>
          </div>
          {data?.mode === 'personal' && (
            <>
              <nav className="ritual-destinations" aria-label="Your grooming tools">
                <Link href="/app/grooming/look">Your Look ↗</Link>
                <Link href="/app/collection/cabinet">Your Cabinet ↗</Link>
                <button onClick={() => setReviewWeek(true)}>Progress ↗</button>
                {ritual && <button onClick={() => setEditing(true)}>Refine ritual ↗</button>}
              </nav>
            </>
          )}
        </div>
      </section>
      <ContextSheet
        open={reviewWeek}
        title="Your optional practice history"
        onClose={() => setReviewWeek(false)}
      >
        <p>Recorded practice · {data?.mode === 'personal' ? data.timezone : ''}</p>
        <p>
          Recent recorded practice, up to 100 entries. Consistency is not a skin or appearance
          score.
        </p>
        {data?.mode === 'personal' && (
          <div className="ritual-week-summary">
            <p className="gw-kicker">YOUR RECORDED RHYTHM</p>
            <p>
              <strong>{summary.days}</strong> {summary.days === 1 ? 'day' : 'days'} with practice ·{' '}
              <strong>{summary.recorded}</strong> recorded{' '}
              {summary.recorded === 1 ? 'ritual' : 'rituals'}
            </p>
            {summary.effort > 0 && (
              <p>
                “Too much effort” recorded {summary.effort}{' '}
                {summary.effort === 1 ? 'time' : 'times'}. Consider reviewing which steps you want
                to keep.
              </p>
            )}
            {summary.irritation > 0 && (
              <p>
                “Something irritated” recorded {summary.irritation}{' '}
                {summary.irritation === 1 ? 'time' : 'times'}. Review your notes and products before
                your next practice.
              </p>
            )}
            {(summary.effort > 0 || summary.irritation > 0) && (
              <p>
                Feedback spans your recorded rituals. It does not identify a cause or a specific
                routine.
              </p>
            )}
            {ritual && (summary.effort > 0 || summary.irritation > 0) && (
              <button
                onClick={() => {
                  setReviewWeek(false);
                  setEditing(true);
                }}
              >
                Review selected {effectiveKind} ritual ↗
              </button>
            )}
          </div>
        )}
        {data?.mode === 'personal' && (
          <ol className="ritual-week">
            {data.week.map((item) => (
              <li key={item.day}>
                <time dateTime={item.day}>{dayLabel(item.day, true)}</time>
                <strong>
                  {item.completed
                    ? `${item.completed} ritual${item.completed === 1 ? '' : 's'} recorded`
                    : 'No recorded practice'}
                </strong>
                {item.notes.map((note, i) => (
                  <small key={i}>{note} · Your feedback</small>
                ))}
              </li>
            ))}
          </ol>
        )}
        <Link href="/app/grooming#progress">Private visual history ↗</Link>
      </ContextSheet>
      <ContextSheet
        open={editing}
        title={ritual ? 'Refine your ritual' : 'Create your ritual'}
        busy={busy}
        fullScreen
        onClose={() => setEditing(false)}
      >
        {data?.mode === 'personal' && (
          <RitualEditor
            key={`${data.ownerId}:${effectiveKind}:${ritual?.id ?? 'new'}`}
            ownerId={data.ownerId}
            kind={effectiveKind}
            ritual={ritual}
            proposal={activeSuggestion?.kind === effectiveKind ? activeSuggestion : undefined}
            sourceTurnId={
              activeSuggestion?.kind === effectiveKind ? activeSuggestion.sourceTurnId : null
            }
            onBusy={setBusy}
            onSaved={() => {
              setEditing(false);
              setActiveSuggestion(null);
              setRevision((r) => r + 1);
            }}
          />
        )}
      </ContextSheet>
      <ContextSheet
        open={practice}
        title="Your grooming ritual"
        busy={busy}
        fullScreen
        onClose={() => setPractice(false)}
      >
        {ritual && (
          <RitualPractice
            key={`${data?.mode === 'personal' ? data.ownerId : 'guest'}:${ritual.id}:${quick}`}
            quick={quick > 0}
            ritual={ritual}
            account={data?.mode === 'personal' ? data : null}
            recordedToday={recordedToday}
            onBusy={setBusy}
            onRecorded={recorded}
            onFeedbackSaved={() => setRevision((r) => r + 1)}
          />
        )}
      </ContextSheet>
    </>
  );
}
function RitualPractice({
  ritual,
  account,
  recordedToday,
  onBusy,
  onRecorded,
  onFeedbackSaved,
  quick = false,
}: {
  quick?: boolean;
  ritual: WorldRitual;
  account: Extract<GroomingWorldSnapshot, { mode: 'personal' }> | null;
  recordedToday: boolean;
  onBusy: (busy: boolean) => void;
  onRecorded: (at: string) => void;
  onFeedbackSaved: () => void;
}) {
  const steps = ritualSteps(ritual.steps);
  const [overview, setOverview] = useState(false);
  const [step, setStep] = useState(0),
    [saved, setSaved] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState(''),
    [blocked, setBlocked] = useState(false);
  const [receipt, setReceipt] = useState<null | { id: string }>(null),
    [feedback, setFeedback] = useState(''),
    [feedbackError, setFeedbackError] = useState(''),
    [feedbackBusy, setFeedbackBusy] = useState(false),
    [feedbackChoice, setFeedbackChoice] = useState<string | null>(null);
  const feedbackLock = useRef<string | null>(null);
  const requestId = useRef<string | null>(null),
    lock = useRef(false),
    abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  async function record() {
    if (lock.current || saved || recordedToday || blocked) return;
    if (!account) {
      setSaved(true);
      return;
    }
    lock.current = true;
    setPending(true);
    onBusy(true);
    setError('');
    requestId.current ??= crypto.randomUUID();
    const controller = new AbortController();
    abort.current = controller;
    try {
      const response = await fetch('/api/world/grooming', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerId: account.ownerId,
          ritualId: ritual.id,
          requestId: requestId.current,
          day: account.day,
          version: ritual.version,
        }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409 || response.status === 401 || response.status === 403)
          setBlocked(true);
        throw new Error(result.error ?? 'Your practice could not be confirmed.');
      }
      const receipt = practiceReceipt.parse(result);
      if (receipt.requestId !== requestId.current || receipt.ritualId !== ritual.id)
        throw new Error('The recording response could not be verified. Retry to confirm it.');
      if (controller.signal.aborted) return;
      track('first_meaningful_action');
      onRecorded(receipt.occurredAt);
      setReceipt(receipt);
      setSaved(true);
    } catch (e) {
      if (!controller.signal.aborted)
        setError(
          e instanceof Error && e.name === 'Error'
            ? e.message
            : 'The save could not be confirmed. Retry to confirm this same practice.',
        );
    } finally {
      if (!controller.signal.aborted) {
        lock.current = false;
        setPending(false);
        onBusy(false);
      }
    }
  }
  const recordQuick = useEffectEvent(record);
  useEffect(() => {
    if (!quick) return;
    const timer = setTimeout(() => void recordQuick(), 0);
    return () => clearTimeout(timer);
  }, [quick]); // One explicit quick-completion click starts this mounted runner.
  async function note(value: string) {
    if (!account || !receipt || feedbackBusy) return;
    feedbackLock.current ??= value;
    setFeedbackChoice(feedbackLock.current);
    setFeedbackBusy(true);
    setFeedbackError('');
    try {
      const response = await fetch('/api/grooming/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerId: account.ownerId,
          checkinId: receipt.id,
          note: feedbackLock.current,
        }),
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error();
      const result = await response.json();
      if (result.saved !== true) throw new Error();
      setFeedback(feedbackLock.current);
      onFeedbackSaved();
    } catch {
      setFeedbackError('Feedback could not be confirmed. Retry the same choice.');
    } finally {
      setFeedbackBusy(false);
    }
  }
  return (
    <div className="gw-ritual-practice">
      <p className="gw-kicker">
        {account ? 'YOUR SAVED RITUAL' : 'SAMPLE / NOT SAVED TO AN ACCOUNT'}
      </p>
      <h3>{ritual.title}</h3>
      {!quick && (
        <div className="ritual-view-switch" role="group" aria-label="Ritual view">
          <button aria-pressed={!overview} onClick={() => setOverview(false)}>
            Guided
          </button>
          <button aria-pressed={overview} onClick={() => setOverview(true)}>
            All steps
          </button>
        </div>
      )}
      {!quick && (
        <p className="gw-ritual-position">
          {String(step + 1).padStart(2, '0')} <span>/ {String(steps.length).padStart(2, '0')}</span>
        </p>
      )}
      {!quick && !overview && (
        <p className="gw-ritual-step" aria-live="polite">
          {steps[step]}
        </p>
      )}
      {!quick && overview && (
        <ol className="ritual-step-map" aria-label="Saved ritual steps">
          {steps.map((text, index) => (
            <li key={index}>
              <button
                aria-current={index === step ? 'step' : undefined}
                onClick={() => {
                  setStep(index);
                  setOverview(false);
                }}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                {text}
              </button>
            </li>
          ))}
        </ol>
      )}
      <RitualProducts ritual={ritual} />
      {quick && <p>Recording the ritual you have already completed.</p>}
      <div className="gw-ritual-navigation">
        {!quick && (
          <button disabled={step === 0 || pending} onClick={() => setStep((i) => i - 1)}>
            ← Back
          </button>
        )}
        {!quick && step < steps.length - 1 ? (
          <button className="gw-action" onClick={() => setStep((i) => i + 1)}>
            Next step →
          </button>
        ) : (
          <button
            className="gw-action"
            disabled={pending || saved || recordedToday || blocked}
            onClick={() => void record()}
          >
            {pending
              ? 'Recording…'
              : saved || recordedToday
                ? 'Recorded'
                : account
                  ? 'Record this practice'
                  : 'Finish sample practice'}
          </button>
        )}
      </div>
      <p className="gw-muted">
        {account
          ? 'Record only what you have done. This is your own practice log.'
          : 'An example of the flow, not a personalized routine.'}
      </p>
      {error && (
        <p role="alert">
          {error}
          {blocked && (
            <>
              {' '}
              <button onClick={() => location.reload()}>Reload Grooming</button>
            </>
          )}
        </p>
      )}
      <p role="status" className="gw-confirmation">
        {saved
          ? account
            ? 'Recorded in your grooming history.'
            : 'Sample complete. Nothing was saved to an account.'
          : recordedToday
            ? 'You have already recorded this ritual today.'
            : ''}
      </p>
      {saved && account && (
        <div className="ritual-feedback">
          <p>How did it feel? · Optional</p>
          {!feedback ? (
            <div role="group" aria-label="Practice feedback">
              {feedbackChoices.map((value) => (
                <button
                  key={value}
                  disabled={feedbackBusy || (!!feedbackChoice && feedbackChoice !== value)}
                  onClick={() => void note(value)}
                >
                  {value}
                </button>
              ))}
            </div>
          ) : (
            <p role="status">{feedback} · Feedback saved.</p>
          )}
          {feedbackError && <p role="alert">{feedbackError}</p>}
        </div>
      )}
      <Link href={account ? '/app/grooming#ritual' : '/enter'}>
        {account ? 'Refine this ritual in your Concierge' : 'Member sign in'} ↗
      </Link>
    </div>
  );
}

function RitualProducts({ ritual }: { ritual: WorldRitual }) {
  return (
    <details className="ritual-products">
      <summary>Your linked products · {ritual.productCount}</summary>
      {ritual.products.length ? (
        <ul>
          {ritual.products.map((product) => (
            <li key={product.id}>
              <strong>{product.name}</strong>
              <span>{product.relation.replaceAll('_', ' ')} · Member recorded</span>
              {product.note && <p>{product.note}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <p>No linked products. Follow your existing routine; adding products is optional.</p>
      )}
      {ritual.productCount > ritual.products.length && (
        <p>Showing the latest {ritual.products.length} links.</p>
      )}
      <Link href="/app/collection/cabinet">Review your Cabinet ↗</Link>
    </details>
  );
}
