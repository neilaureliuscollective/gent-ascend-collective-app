'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { dayLabel, sampleData, type DailyData } from '@/domains/daily/model';
import { projectCommand, type CommandProjection } from '@/domains/command/projection';
import { commandChanges } from '@/domains/command/changes';
import { CommandField } from './command-field';
import type { CommandData } from '@/domains/daily-command/model';
import { approachingOccasion, type PresenceData } from '@/domains/presence/model';
import { HomeConversation } from './home-conversation';
import '@/app/command-living.css';
const DailyDepth = dynamic(() => import('./daily-depth').then((module) => module.DailyDepth), {
  loading: () => <p role="status">Opening your day workspace…</p>,
});
function greeting(asOf: string | undefined, timezone: string) {
  if (!asOf) return 'Welcome back';
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(new Date(asOf)),
  );
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}
export function DailyDashboard({
  initial,
  opening,
  asOf,
  dailyCommand,
  presence,
}: {
  initial: DailyData;
  opening?: CommandProjection;
  asOf?: string;
  dailyCommand?: CommandData | null;
  presence?: PresenceData | null;
}) {
  const [data, setData] = useState(initial);
  const [operating, setOperating] = useState(dailyCommand ?? null);
  const safeInitial = useRef(initial);
  const [depth, setDepth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [checkedAt, setCheckedAt] = useState(asOf ?? null);
  const [changes, setChanges] = useState<string[]>([]);
  const [stale, setStale] = useState(false);
  const [confirmMove, setConfirmMove] = useState<'adopt' | 'complete' | null>(null);
  const [confirmedRevision, setConfirmedRevision] = useState(0);
  const confirmation = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const focusPending = useRef(false);
  const lastCheck = useRef(0);
  const lock = useRef(false);
  const projection = data === initial && opening ? opening : projectCommand(data);
  const proposal = projection.decisions[0];
  const occasion = presence?.mode === 'personal' ? approachingOccasion(presence.occasions, presence.today) : null;
  function openPlan() {
    if (busy || lock.current) return;
    setDepth(true);
  }
  const focusDepth = useCallback(() => {
    const target = document.getElementById('command-depth');
    target?.scrollIntoView({ behavior: 'auto', block: 'start' });
    target?.focus({ preventScroll: true });
  }, []);
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const response = await fetch('/api/command', {
        cache: 'no-store',
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
          : AbortSignal.timeout(15000),
      });
      if (response.status === 401 || response.status === 403) {
        const cleared: DailyData = {
          mode: 'preview',
          name: null,
          today: data.today,
          timezone: data.timezone,
          entries: [],
          goal: null,
          conversation: null,
        };
        safeInitial.current = cleared;
        setData(cleared);
        setOperating(null);
        setChanges([]);
        setCheckedAt(null);
        setDepth(false);
        throw new Error('Your session changed. Sign in again to load your context.');
      }
      if (!response.ok) throw new Error('Saved context could not be refreshed.');
      const snapshot = (await response.json()) as { data: DailyData; asOf: string };
      if (signal?.aborted) return;
      if (data.ownerId && snapshot.data.ownerId !== data.ownerId) {
        const cleared: DailyData = {
          mode: 'preview',
          name: null,
          today: data.today,
          timezone: data.timezone,
          entries: [],
          goal: null,
          conversation: null,
        };
        safeInitial.current = cleared;
        setData(cleared);
        setOperating(null);
        setChanges([]);
        setCheckedAt(null);
        setDepth(false);
        throw new Error('Your account changed. Reload to open the correct Command.');
      }
      if (dailyCommand) {
        let updated: CommandData | null = null;
        try {
          const operatingResponse = await fetch('/api/daily-command', {
            cache: 'no-store',
            signal: signal
              ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
              : AbortSignal.timeout(15000),
          });
          if (operatingResponse.ok) updated = (await operatingResponse.json()) as CommandData;
        } catch {
          /* The sourced briefing remains usable when this independent read fails. */
        }
        if (signal?.aborted) return;
        setOperating(
          updated?.ownerId === snapshot.data.ownerId &&
            updated?.snapshot?.day === snapshot.data.today
            ? updated
            : null,
        );
      }
      setChanges(commandChanges(data, snapshot.data));
      setData(snapshot.data);
      setCheckedAt(snapshot.asOf);
      lastCheck.current = Date.now();
      setStale(false);
    },
    [data, dailyCommand],
  );
  // No polling. Deeper workspace and confirmation dialogs protect unsaved drafts.
  useEffect(() => {
    if (!lastCheck.current) lastCheck.current = Date.now();
    if (data.mode !== 'personal' || depth || uncertain || confirmMove) return;
    const controller = new AbortController();
    async function resume() {
      if (
        document.visibilityState !== 'visible' ||
        lock.current ||
        Date.now() - lastCheck.current < 60000 ||
        document.querySelector('dialog[open]')
      )
        return;
      lock.current = true;
      setBusy(true);
      lastCheck.current = Date.now();
      try {
        await refresh(controller.signal);
      } catch {
        if (!controller.signal.aborted) setStale(true);
      } finally {
        lock.current = false;
        setBusy(false);
      }
    }
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('focus', resume);
    return () => {
      controller.abort();
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('focus', resume);
    };
  }, [data.mode, depth, uncertain, confirmMove, refresh]);
  function askMove(kind: 'adopt' | 'complete') {
    returnFocus.current = document.activeElement as HTMLElement;
    setConfirmMove(kind);
    confirmation.current?.showModal();
  }
  function closeMove() {
    confirmation.current?.close();
    focusPending.current = true;
    setConfirmMove(null);
  }
  useEffect(() => {
    // Wait for the saved-state render to re-enable the trigger before restoring focus.
    if (busy || confirmMove || !focusPending.current) return;
    focusPending.current = false;
    const trigger = returnFocus.current;
    if (trigger?.isConnected && !trigger.matches(':disabled'))
      trigger.focus({ preventScroll: true });
    else document.getElementById('command-move-title')?.focus({ preventScroll: true });
  }, [busy, confirmMove]);
  async function confirm() {
    if (!confirmMove || lock.current || uncertain || data.mode !== 'personal') return;
    lock.current = true;
    setBusy(true);
    setFeedback('');
    const kind = confirmMove;
    try {
      const body =
        kind === 'adopt'
          ? {
              ownerId: data.ownerId,
              day: data.today,
              version: projection.day.version,
              source: projection.move.kind,
              title: projection.move.title,
              approve: true,
            }
          : {
              day: data.today,
              version: projection.day.version,
              actionId: projection.move.actionId,
            };
      const response = await fetch(kind === 'adopt' ? '/api/command' : '/api/daily/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'The change could not be confirmed.');
      await refresh();
      setConfirmedRevision((revision) => revision + 1);
      setFeedback(
        kind === 'adopt'
          ? 'Confirmed. Your move is now in today’s saved plan.'
          : 'Completion confirmed. Your saved plan is refreshed.',
      );
      closeMove();
    } catch (error) {
      setUncertain(true);
      setStale(true);
      setFeedback(
        `${error instanceof Error ? error.message : 'The change was not confirmed.'} Reload saved context before trying again.`,
      );
      closeMove();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function decide(approve: boolean) {
    if (!proposal || lock.current || uncertain || depth || data.mode !== 'personal') return;
    lock.current = true;
    setBusy(true);
    setFeedback('');
    try {
      const response = await fetch('/api/aurelius/actions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId: proposal.id,
          approve,
          title: approve ? proposal.title : null,
        }),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'The decision was not confirmed.');
      await refresh();
      setConfirmedRevision((revision) => revision + 1);
      setFeedback(
        approve
          ? 'Approved. Your day has been refreshed.'
          : 'Declined. Your saved context has been refreshed.',
      );
    } catch (error) {
      setUncertain(true);
      setStale(true);
      setFeedback(
        `${error instanceof Error ? error.message : 'The decision could not be confirmed.'} Reload saved context before trying again.`,
      );
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
      await refresh();
      setUncertain(false);
      setFeedback('Saved context loaded.');
    } catch {
      setStale(true);
      setFeedback('Saved context is unavailable. Try again when connected.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div
      className="command-briefing command-living command-home"
      data-status={busy ? 'refreshing' : stale ? 'stale' : 'ready'}
    >
      <section className="command-environment" aria-labelledby="command-title">
        <header className="command-arrival">
          <span>
            Command <span aria-hidden="true">/</span> {dayLabel(data.today, true)}
          </span>
          <span>
            {data.mode === 'sample'
              ? 'Fictional sample'
              : data.mode === 'preview'
                ? 'Personal preview'
                : data.timezone.replaceAll('_', ' ')}
          </span>
        </header>
        <div className="command-moment">
          <p className="command-kicker">Your Gent Ascend</p>
          <h1 id="command-title">
            {data.name
              ? `${greeting(checkedAt ?? asOf, data.timezone)}, ${data.name}.`
              : 'Your day. Your direction.'}
          </h1>
          <p className="home-brief">{projection.briefing}</p>
        </div>
        <CommandField
          projection={projection}
          openPlan={openPlan}
          status={busy ? 'refreshing' : stale ? 'stale' : 'ready'}
          changed={changes.length > 0}
          confirmedRevision={confirmedRevision}
        />
        <section className="command-next" aria-label="Today’s move">
          <div>
            <span>Now / Today’s move</span>
            <h2 id="command-move-title" tabIndex={-1}>
              {projection.move.title}
            </h2>
            <p>{projection.move.source}</p>
          </div>
          {data.mode === 'personal' && projection.move.kind === 'action' ? (
            <button
              className="command-action"
              disabled={busy || uncertain || stale || depth}
              onClick={() => askMove('complete')}
            >
              Mark complete <span aria-hidden="true">↗</span>
            </button>
          ) : data.mode === 'personal' && data.ownerId && projection.canAdopt ? (
            <button
              className="command-action"
              disabled={busy || uncertain || stale || depth}
              onClick={() => askMove('adopt')}
            >
              Use this move today <span aria-hidden="true">↗</span>
            </button>
          ) : projection.move.href ? (
            <Link prefetch={false} className="command-action" href={projection.move.href}>
              See next step <span aria-hidden="true">↗</span>
            </Link>
          ) : (
            <button className="command-action" onClick={openPlan}>
              Open day workspace <span aria-hidden="true">↗</span>
            </button>
          )}
        </section>
        <HomeConversation key={`${data.mode}:${data.ownerId ?? 'preview'}`} data={data} />
        {occasion && (
          <section className="command-next" aria-label="Ahead">
            <div>
              <span>Ahead / {dayLabel(occasion.day, true)}</span>
              <h2>{occasion.title}</h2>
              <p>
                {occasion.note
                  ? `${occasion.note} · Aethelios can help you prepare before the moment arrives.`
                  : 'Aethelios can help you prepare your appearance, wardrobe and timing before the moment arrives.'}
              </p>
            </div>
            <Link prefetch={false} className="command-action" href="/app/aethelios?starter=presence">
              Prepare with Aethelios <span aria-hidden="true">↗</span>
            </Link>
          </section>
        )}
      </section>
      <nav className="home-worlds" aria-label="Your primary spaces">
        <Link prefetch={false} href="/app/aethelios">
          <small>ASK · PLAN · ACT</small>
          <strong>Aethelios</strong>
          <span>
            Tell me what you need <i aria-hidden="true">↗</i>
          </span>
        </Link>
        <Link prefetch={false} href="/app/world">
          <small>YOUR CONTEXT</small>
          <strong>Life</strong>
          <span>
            See what Gent Ascend knows <i aria-hidden="true">↗</i>
          </span>
        </Link>
        <Link prefetch={false} href="/app/collection" className="home-collection">
          <small>PRODUCTS · SERVICES · BENEFITS</small>
          <strong>Collective</strong>
          <span>
            Access what supports you <i aria-hidden="true">↗</i>
          </span>
        </Link>
      </nav>
      {data.mode === 'sample' && (
        <div className="command-mode">
          <span>Sample experience · Fictional records. Changes stay in this view.</span>
          <button
            className="text-button"
            onClick={() => {
              setData(safeInitial.current);
              setDepth(false);
              setFeedback('');
              setStale(false);
              setChanges([]);
              setUncertain(false);
            }}
          >
            Exit sample
          </button>
        </div>
      )}
      {data.mode === 'preview' && (
        <div className="command-mode">
          <span>Sign in to use your own saved context.</span>
          <button
            className="text-button"
            onClick={() => {
              setData(sampleData(data.today));
              setDepth(false);
              setFeedback('');
              setStale(false);
              setChanges([]);
              setUncertain(false);
            }}
          >
            Explore a sample day ↗
          </button>
        </div>
      )}
      <section
        className="command-oversight"
        aria-label="Needs you"
        data-empty={!proposal && projection.decisionsAvailable && !stale}
      >
        <div>
          <span className="command-section-label">Needs you</span>
          <h2>
            {!projection.decisionsAvailable || stale
              ? 'Decision status is unavailable.'
              : proposal
                ? projection.decisions.length > 1
                  ? 'One decision at a time.'
                  : 'One decision to make.'
                : data.mode === 'personal'
                  ? 'Nothing needs you right now.'
                  : 'No account decisions in this view.'}
          </h2>
          <p>
            {proposal
              ? proposal.title
              : !projection.decisionsAvailable || stale
                ? 'Your saved day is still available. Reload to check pending decisions.'
                : 'No new approval step. Go live your day.'}
          </p>
        </div>
        {proposal && (
          <div className="command-decision">
            <p>Saved Aethelios suggestion · not added to your day</p>
            <button
              className="secondary-button"
              disabled={busy || uncertain || stale || depth}
              onClick={() => void decide(true)}
            >
              Approve action
            </button>
            <button
              className="text-button"
              disabled={busy || uncertain || stale || depth}
              onClick={() => void decide(false)}
            >
              Decline
            </button>
            {projection.decisions.length > 1 && (
              <details>
                <summary>{projection.decisions.length - 1} more saved suggestions</summary>
                <ul>
                  {projection.decisions.slice(1).map((item) => (
                    <li key={item.id}>{item.title}</li>
                  ))}
                </ul>
                <p>Oldest first. Decide the current suggestion to continue.</p>
              </details>
            )}
          </div>
        )}
        {projection.decisions.length > 1 && (
          <details className="command-more-decisions">
            <summary>{projection.decisions.length - 1} more saved suggestions</summary>
            <p>Shown in the order they were saved. No urgency is inferred.</p>
            <ul>
              {projection.decisions.slice(1).map((item) => (
                <li key={item.id}>{item.title}</li>
              ))}
            </ul>
          </details>
        )}
        {(uncertain || stale || !projection.decisionsAvailable) && (
          <button className="text-button" disabled={busy || depth} onClick={() => void reload()}>
            Reload saved context
          </button>
        )}
      </section>
      <p className="command-feedback" role="status">
        {busy ? 'Confirming saved state…' : feedback}
      </p>
      <details className="home-records">
        <summary>
          Your saved context <span aria-hidden="true">+</span>
        </summary>
        <p className="home-record-source">{projection.briefingSource}</p>
        <section className="command-continuity" aria-label="In motion">
          <span className="command-section-label">In motion</span>
          <p>
            {busy
              ? 'Refreshing saved context…'
              : stale
                ? 'Showing the last loaded context. Refresh is unavailable.'
                : projection.receipts.length
                  ? 'Your saved context is organized. No new input required.'
                  : 'Nothing to prepare right now.'}
          </p>
          {!!changes.length && <p className="command-changes">{changes.join(' ')}</p>}
          {!!projection.receipts.length && (
            <details className="command-receipts">
              <summary>What was prepared</summary>
              <ul>
                {projection.receipts.map((receipt) => (
                  <li key={receipt.id}>
                    <strong>{receipt.title}</strong>
                    <p>{receipt.detail}</p>
                    <small>{receipt.source}</small>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {!!data.openCaptures && (
            <Link prefetch={false} href="/app/captures">
              {data.openCaptures} saved {data.openCaptures === 1 ? 'capture' : 'captures'} in your
              inbox ↗
            </Link>
          )}
          <small>
            {checkedAt && data.mode === 'personal'
              ? `Prepared at ${new Intl.DateTimeFormat('en-US', { timeZone: data.timezone, hour: 'numeric', minute: '2-digit' }).format(new Date(checkedAt))}. `
              : ''}
            Saved records only. Model context stays under your conversation controls.
          </small>
          {data.mode === 'personal' && (
            <button
              className="text-button"
              disabled={busy || depth || !!confirmMove}
              onClick={() => void reload()}
            >
              Refresh briefing
            </button>
          )}
        </section>
        {data.mode === 'personal' && (
          <section className="command-readiness" aria-label="Daily Command connection">
            <div>
              <span className="command-section-label">Your operating state</span>
              <h2>
                {operating?.snapshot?.confidence.known
                  ? operating.snapshot.state
                  : 'Arrival signals incomplete'}
              </h2>
              <p>
                {operating?.snapshot?.reason ??
                  'Your arrival context is unavailable. Open Daily Command to reconnect.'}
              </p>
              <small>
                {operating?.snapshot
                  ? `${operating.snapshot.confidence.known}/3 recovery signals · product guidance, not a health measurement`
                  : 'No state inferred.'}
              </small>
            </div>
            <Link prefetch={false} className="command-action" href="/app/arrival">
              Arrival & feedback ↗
            </Link>
          </section>
        )}
      </details>
      <details className="home-records">
        <summary>
          Open deeper systems <span aria-hidden="true">+</span>
        </summary>
        <nav className="command-depth-nav" aria-label="Deeper systems">
          <button
            disabled={busy}
            aria-expanded={depth}
            aria-controls="command-depth"
            onClick={() => (depth ? setDepth(false) : openPlan())}
          >
            {depth ? 'Close day workspace' : 'Day workspace'} <span>↗</span>
          </button>
          <Link prefetch={false} href="/app/studio">
            Studio <span>↗</span>
          </Link>
          <Link prefetch={false} href="/app/performance">
            Performance <span>↗</span>
          </Link>
          <Link prefetch={false} href="/app/presence">
            Presence <span>↗</span>
          </Link>
          <Link prefetch={false} href="/app/progress">
            Progress <span>↗</span>
          </Link>
          <Link prefetch={false} href="/app/ascend-profile">
            Direction <span>↗</span>
          </Link>
        </nav>
      </details>
      {depth && (
        <div id="command-depth" tabIndex={-1} aria-label="Day workspace">
          <DailyDepth initial={data} onChange={setData} onReady={focusDepth} />
        </div>
      )}
      <dialog
        ref={confirmation}
        className="daily-editor command-confirmation"
        aria-labelledby="command-confirm-title"
        onCancel={(event) => {
          event.preventDefault();
          if (!busy) closeMove();
        }}
      >
        <h2 id="command-confirm-title">
          {confirmMove === 'adopt' ? 'Use this move today?' : 'Confirm this is complete?'}
        </h2>
        <p>{projection.move.title}</p>
        <small>{projection.move.source}</small>
        <p>
          {confirmMove === 'adopt'
            ? 'This adds your saved next step to today’s plan. Your other records stay intact.'
            : 'Only you can confirm what happened. This updates your saved action.'}
        </p>
        <button className="button" disabled={busy || uncertain} onClick={() => void confirm()}>
          {busy ? 'Confirming…' : confirmMove === 'adopt' ? 'Confirm move' : 'Confirm completion'}
        </button>
        <button className="text-button" disabled={busy} onClick={closeMove}>
          Cancel
        </button>
      </dialog>
    </div>
  );
}
