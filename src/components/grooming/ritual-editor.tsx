'use client';
import { useRef, useState } from 'react';
import { ritualDraftInput, starterRitual, ritualSteps } from '@/domains/grooming/ritual-model';
import type { WorldRitual } from '@/domains/grooming/world-model';
import { RitualStepBuilder } from './ritual-step-builder';
export function RitualEditor({
  ownerId,
  kind,
  ritual,
  onBusy,
  onSaved,
  sourceTurnId = null,
  proposal,
}: {
  ownerId: string;
  kind: 'morning' | 'evening' | 'weekly';
  ritual?: WorldRitual;
  onBusy: (busy: boolean) => void;
  onSaved: () => void;
  sourceTurnId?: string | null;
  proposal?: { title: string; steps: string; reason: string };
}) {
  const [title, setTitle] = useState(proposal?.title ?? ritual?.title ?? ''),
    [steps, setSteps] = useState(proposal?.steps ?? ritual?.steps ?? '');
  const [review, setReview] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState(''),
    [blocked, setBlocked] = useState(false);
  const request = useRef<ReturnType<typeof ritualDraftInput.parse> | null>(null),
    lock = useRef(false);
  const [uncertain, setUncertain] = useState(false);
  function starter(focus: 'hair' | 'beard' | 'skin') {
    const draft = starterRitual(focus, kind);
    setTitle(draft.title);
    setSteps(draft.steps);
  }
  async function save() {
    if (lock.current || blocked) return;
    const parsed = ritualDraftInput.safeParse({
      ownerId,
      requestId: request.current?.requestId ?? crypto.randomUUID(),
      kind,
      expectedVersion: ritual?.version ?? 0,
      title,
      steps,
      sourceTurnId,
    });
    if (!parsed.success) {
      setError('Give the ritual a name and practical steps.');
      return;
    }
    request.current ??= parsed.data;
    lock.current = true;
    setPending(true);
    onBusy(true);
    setError('');
    try {
      const response = await fetch('/api/grooming/ritual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request.current),
        signal: AbortSignal.timeout(12000),
      });
      const result = await response.json();
      if (!response.ok) {
        if ([401, 403, 409].includes(response.status)) {
          setBlocked(true);
          setUncertain(false);
        } else setUncertain(true);
        throw new Error(result.error ?? 'The save could not be confirmed.');
      }
      if (result.requestId !== request.current.requestId)
        throw new Error('The save could not be confirmed.');
      setUncertain(false);
      onSaved();
    } catch (e) {
      setUncertain(true);
      setError(
        e instanceof Error && e.name === 'Error'
          ? e.message
          : 'The save could not be confirmed. Retry the same draft.',
      );
    } finally {
      lock.current = false;
      setPending(false);
      onBusy(false);
    }
  }
  return (
    <div className="ritual-editor">
      <p className="gw-kicker">{ritual ? 'REFINE YOUR RITUAL' : 'START WITH WHAT WORKS'}</p>
      {proposal && <p>{proposal.reason} · Aethelios suggestion. Review every step.</p>}
      {!ritual && !proposal && (
        <div className="ritual-starters" role="group" aria-label="Starter focus">
          {(['beard', 'hair', 'skin'] as const).map((focus) => (
            <button
              key={focus}
              type="button"
              disabled={review || pending || uncertain}
              onClick={() => starter(focus)}
            >
              {focus}
            </button>
          ))}
        </div>
      )}
      {!review ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!ritualSteps(steps).length || steps.trim().length < 3 || title.trim().length < 3) {
              setError('Give the ritual a name and at least one practical step.');
              return;
            }
            setReview(true);
            setError('');
          }}
        >
          <label>
            Name
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              minLength={3}
              maxLength={100}
              required
            />
          </label>
          <label>
            Steps · one per line
            <textarea
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              minLength={3}
              maxLength={1000}
              rows={7}
              required
            />
          </label>
          <RitualStepBuilder value={steps} onChange={setSteps} />
          <p>
            Your existing products and their label directions come first. These starter drafts
            describe familiar care, not a prescription.
          </p>
          <button className="gw-action" type="submit">
            Review ritual →
          </button>
        </form>
      ) : (
        <>
          <div className="ritual-review">
            <h3>{title}</h3>
            <p className="ritual-change-count">
              {ritual
                ? `${ritualSteps(ritual.steps).length} current steps → ${ritualSteps(steps).length} reviewed steps`
                : `${ritualSteps(steps).length} reviewed steps`}
            </p>
            <ol>
              {ritualSteps(steps).map((text, i) => (
                <li key={i}>{text}</li>
              ))}
            </ol>
            {ritual && (
              <details>
                <summary>Compare with your current ritual</summary>
                <p>{ritual.title}</p>
                <p className="groom-lines">{ritual.steps}</p>
              </details>
            )}
            <p>
              {ritual
                ? 'This saves a new version and keeps your linked products. Earlier practice stays in history.'
                : 'Nothing changes until you save.'}
            </p>
          </div>
          <div className="gw-ritual-navigation">
            <button
              disabled={pending || uncertain || blocked}
              onClick={() => {
                request.current = null;
                setReview(false);
              }}
            >
              Edit draft
            </button>
            <button className="gw-action" disabled={pending || blocked} onClick={() => void save()}>
              {pending ? 'Saving…' : uncertain ? 'Confirm this same save' : 'Save reviewed ritual'}
            </button>
          </div>
        </>
      )}
      {error && (
        <p role="alert">
          {error}{' '}
          {blocked ? (
            <button onClick={() => location.reload()}>Reload Grooming</button>
          ) : uncertain ? (
            'Your draft is locked while the save is uncertain. Retry to confirm it.'
          ) : (
            ''
          )}
        </p>
      )}
    </div>
  );
}
