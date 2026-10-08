'use client';
import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import { prioritySnapshot, type PersonalPriority } from '@/domains/daily/world-priority-model';
import { firstSessionPaths } from '@/domains/onboarding/first-session';
import { track } from '@/domains/onboarding/track';

export function FirstSession({
  initial,
  canTalk,
}: {
  initial: PersonalPriority | null;
  canTalk: boolean;
}) {
  const [snapshot, setSnapshot] = useState(initial);
  const [choice, setChoice] = useState<keyof typeof firstSessionPaths>('project');
  const [intention, setIntention] = useState(initial?.intention ?? '');
  const [action, setAction] = useState(
    initial?.nextAction ?? (firstSessionPaths.project.action as string),
  );
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState('');
  const lock = useRef(false);
  const path = firstSessionPaths[choice];

  async function reload() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const response = await fetch('/api/world/priority', {
        cache: 'no-store',
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error();
      const result = prioritySnapshot.parse(await response.json());
      if (result.mode !== 'personal') throw new Error();
      if (snapshot && result.ownerId !== snapshot.ownerId) {
        setMessage(
          'Your account changed. Sign in to the original account or reopen this page before saving.',
        );
        return;
      }
      setSnapshot(result);
      setUncertain(false);
      // Keep the member's unsaved text for comparison after conflicts or a lost acknowledgment.
      setMessage('Saved context reloaded. Compare it with your draft before saving again.');
    } catch {
      setMessage(
        'Your saved context could not load. Sign in again or retry; your draft is still here.',
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (lock.current || !snapshot || uncertain) return;
    lock.current = true;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/world/priority', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerId: snapshot.ownerId,
          day: snapshot.day,
          version: snapshot.version,
          intention,
          nextAction: action,
        }),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Your plan could not be confirmed.');
      const confirmed = prioritySnapshot.parse(result);
      if (
        confirmed.mode !== 'personal' ||
        confirmed.ownerId !== snapshot.ownerId ||
        confirmed.day !== snapshot.day
      )
        throw new Error('Your account or day changed.');
      setSnapshot(confirmed);
      setSaved(true);
      setMessage('Your priority and next move are saved to your daily plan.');
      track('first_meaningful_action');
    } catch (error) {
      setUncertain(true);
      setMessage(
        `${error instanceof Error ? error.message : 'The save was not confirmed.'} Reload saved context before trying again.`,
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="first-session" aria-labelledby="first-session-title">
      <p className="eyebrow">YOUR FIRST CHAPTER</p>
      <h2 id="first-session-title">Start with what matters.</h2>
      <p>Choose one direction. Leave with a next move you can return to.</p>
      {saved ? (
        <div className="first-session-result">
          <p role="status">{message}</p>
          <blockquote>{snapshot?.intention}</blockquote>
          <p>
            <strong>Your reviewed next move:</strong> {action}
          </p>
          <div className="first-session-links">
            <Link className="button" href={path.href}>
              {path.destination} →
            </Link>
            {path.href !== '/app/daily' && (
              <Link className="text-link" href="/app/daily">
                Return to my saved plan →
              </Link>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={(event) => void save(event)}>
          <fieldset disabled={busy}>
            <legend>What do you want to work on?</legend>
            <div className="first-session-choices">
              {Object.entries(firstSessionPaths).map(([key, value]) => (
                <label key={key}>
                  <input
                    type="radio"
                    name="first-focus"
                    checked={choice === key}
                    onChange={() => {
                      setChoice(key as keyof typeof firstSessionPaths);
                      setAction(value.action);
                    }}
                  />
                  <span>{value.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="first-session-guidance">
            <h3>{path.title}</h3>
            <p>{path.detail}</p>
            <p className="muted">A starting suggestion. You choose and edit what gets saved.</p>
          </div>
          {snapshot?.intention && (
            <p>
              <strong>Currently saved:</strong> {snapshot.intention}
            </p>
          )}
          {snapshot?.nextAction && (
            <p>
              <strong>Already in your plan:</strong> {snapshot.nextAction}. Your existing actions
              stay in place.
            </p>
          )}
          <label htmlFor="first-priority">What matters today?</label>
          <textarea
            id="first-priority"
            rows={3}
            maxLength={160}
            required
            disabled={busy}
            value={intention}
            onChange={(e) => setIntention(e.target.value)}
            placeholder="What would make today a step forward?"
          />
          <label htmlFor="first-action">My next move</label>
          <input
            id="first-action"
            maxLength={100}
            required
            disabled={busy}
            value={action}
            onChange={(e) => setAction(e.target.value)}
          />
          <p className="muted">
            Confirming updates today’s priority and adds this move to your existing plan.
          </p>
          <button
            className="button"
            disabled={busy || uncertain || !snapshot || !intention.trim() || !action.trim()}
          >
            {busy ? 'Saving your next move…' : 'Save priority and next move'}
          </button>
          {(!snapshot || uncertain) && (
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={() => void reload()}
            >
              Reload saved context
            </button>
          )}
          {message && <p role="status">{message}</p>}
        </form>
      )}
      <div className="first-session-links">
        {canTalk ? (
          <Link className="text-link" href="/app/aethelios?starter=first-session">
            Talk this through with Aethelios →
          </Link>
        ) : (
          <p className="muted">
            Your free account includes saved daily planning. Intelligence access depends on your
            current membership.{' '}
            <Link href="/app/membership">Review membership access to Aethelios →</Link>
          </p>
        )}
        <Link className="text-link" href="/app/work">
          Explore your work →
        </Link>
        <Link className="text-link" href="/app/daily">
          Continue to my daily plan →
        </Link>
      </div>
    </section>
  );
}
