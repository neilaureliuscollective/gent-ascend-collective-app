'use client';
import { track } from '@/domains/onboarding/track';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
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
};

export function GroomingWorld() {
  const params = useSearchParams();
  const selected = Math.max(
    0,
    groomingAreas.findIndex((a) => a.id === params.get('area')),
  );
  const area = groomingAreas[selected]!;
  const [data, setData] = useState<GroomingWorldSnapshot | null>(null),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0);
  const [kind, setKind] = useState<'morning' | 'evening' | 'weekly'>('morning');
  const [practice, setPractice] = useState(false),
    [busy, setBusy] = useState(false);
  const { ref, solid, saveData } = useWorldAtmosphere();
  useEffect(() => {
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
  }, [revision]);
  const ritual =
    data?.mode === 'personal'
      ? data.rituals.find((r) => r.kind === kind)
      : data?.mode === 'guest'
        ? sample
        : undefined;
  const today = data?.mode === 'personal' ? data.day : null;
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
        className="gw-grooming"
        ref={ref}
        data-solid={solid}
        data-save-data={saveData}
        aria-labelledby="grooming-world-heading"
      >
        <Link className="gw-grooming-return" href="/experience/world?world=grooming">
          ← Whole-Man World
        </Link>
        <div className="gw-grooming-intro">
          <p className="gw-kicker">02 / GROOMING CONCIERGE</p>
          <h1 id="grooming-world-heading" tabIndex={-1}>
            Your standard.
            <br />
            <em>Made daily.</em>
          </h1>
          <p>Presence begins with how you care for yourself.</p>
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
                  : `${kind.toUpperCase()} / YOUR RITUAL`
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
                        aria-pressed={kind === value}
                        onClick={() => setKind(value)}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                )}
                {ritual ? (
                  <>
                    <button
                      className="gw-action"
                      onClick={() => setPractice(true)}
                      aria-haspopup="dialog"
                    >
                      {data?.mode === 'guest'
                        ? 'Explore a ritual'
                        : recordedToday
                          ? 'Review your ritual'
                          : 'Begin your ritual'}{' '}
                      <span aria-hidden="true">↗</span>
                    </button>
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
                    <p className="gw-ritual-empty">Your {kind} ritual is ready to take shape.</p>
                    <Link className="gw-action" href="/app/grooming#ritual">
                      Create your ritual ↗
                    </Link>
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
            <Link href="/app/grooming">Your full Concierge ↗</Link>
            <Link href="/app/aethelios?starter=grooming">Ask Aethelios ↗</Link>
          </div>
        </div>
      </section>
      <ContextSheet
        open={practice}
        title="Your grooming ritual"
        busy={busy}
        onClose={() => setPractice(false)}
      >
        {ritual && (
          <RitualPractice
            key={`${data?.mode === 'personal' ? data.ownerId : 'guest'}:${ritual.id}`}
            ritual={ritual}
            account={data?.mode === 'personal' ? data : null}
            recordedToday={recordedToday}
            onBusy={setBusy}
            onRecorded={recorded}
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
}: {
  ritual: WorldRitual;
  account: Extract<GroomingWorldSnapshot, { mode: 'personal' }> | null;
  recordedToday: boolean;
  onBusy: (busy: boolean) => void;
  onRecorded: (at: string) => void;
}) {
  const steps = ritual.steps
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const [step, setStep] = useState(0),
    [saved, setSaved] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState(''),
    [blocked, setBlocked] = useState(false);
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
      if (receipt.id !== requestId.current || receipt.ritualId !== ritual.id)
        throw new Error('The recording response could not be verified. Retry to confirm it.');
      if (controller.signal.aborted) return;
      track('first_meaningful_action');
      onRecorded(receipt.occurredAt);
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
  return (
    <div className="gw-ritual-practice">
      <p className="gw-kicker">
        {account ? 'YOUR SAVED RITUAL' : 'SAMPLE / NOT SAVED TO AN ACCOUNT'}
      </p>
      <h3>{ritual.title}</h3>
      <p className="gw-ritual-position">
        {String(step + 1).padStart(2, '0')} <span>/ {String(steps.length).padStart(2, '0')}</span>
      </p>
      <p className="gw-ritual-step" aria-live="polite">
        {steps[step]}
      </p>
      <div className="gw-ritual-navigation">
        <button disabled={step === 0 || pending} onClick={() => setStep((i) => i - 1)}>
          ← Back
        </button>
        {step < steps.length - 1 ? (
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
      <Link href={account ? '/app/grooming#ritual' : '/enter'}>
        {account ? 'Refine this ritual in your Concierge' : 'Member sign in'} ↗
      </Link>
    </div>
  );
}
