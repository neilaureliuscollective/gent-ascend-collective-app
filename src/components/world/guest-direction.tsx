'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { focuses, type DirectionDraft } from '@/domains/onboarding/model';
import { clearDraft, readDraft, writeDraft } from '@/domains/onboarding/draft';
import { track } from '@/domains/onboarding/track';
export function GuestDirection() {
  const [choice, setChoice] = useState<keyof typeof focuses>('body'),
    [action, setAction] = useState(''),
    [done, setDone] = useState(false),
    [retained, setRetained] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const draft = readDraft();
      if (draft) {
        setChoice(draft.focus);
        setAction(draft.intention);
        setDone(!!draft.intention);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  function begin() {
    const draft: DirectionDraft = {
      version: 1,
      id: crypto.randomUUID(),
      focus: choice,
      intention: action.trim(),
      createdAt: Date.now(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    setRetained(writeDraft(draft));
    setDone(true);
    track('direction_created');
    const url = new URL(window.location.href);
    url.searchParams.set('world', focuses[choice].world);
    window.history.replaceState(null, '', url);
  }
  return (
    <section className="gw-direction" id="direction" aria-labelledby="direction-heading">
      <div>
        <p className="gw-kicker">BEGIN WITH ONE THING</p>
        <h2 id="direction-heading">
          What deserves
          <br />
          <em>your attention?</em>
        </h2>
        <p>A small, deliberate next move.</p>
      </div>
      <div>
        <fieldset>
          <legend>Choose your focus</legend>
          <div className="gw-choices">
            {Object.entries(focuses).map(([key, value]) => (
              <label key={key}>
                <input
                  type="radio"
                  name="focus"
                  value={key}
                  checked={choice === key}
                  onChange={() => {
                    setChoice(key as keyof typeof focuses);
                    setDone(false);
                  }}
                />
                <span>{value.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <p>{focuses[choice].action}</p>
        <label htmlFor="guest-action">My next move</label>
        <input
          id="guest-action"
          maxLength={160}
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setDone(false);
          }}
          placeholder="Tomorrow at 7, I will…"
        />
        <button className="gw-action" disabled={!action.trim()} onClick={begin}>
          Set my direction →
        </button>
        <div role="status">
          {done && <p className="gw-confirmation">Your direction: {action}</p>}
        </div>
        <p className="gw-muted">
          {retained
            ? 'Your draft stays on this device for up to 24 hours. Save it to a free account to keep it.'
            : 'Storage is unavailable. Your draft stays in this tab; keep it open while signing in with email.'}{' '}
          Guided reflection, not an AI response.
        </p>
        {done && (
          <>
            <button
              className="gw-action"
              onClick={() => {
                track('claim_clicked');
                window.dispatchEvent(new Event('gent-claim-account'));
              }}
            >
              Save my direction ↗
            </button>
            <Link href={choice === 'focus' ? '/experience/world' : focuses[choice].href}>
              Keep exploring ↗
            </Link>
            <button
              onClick={() => {
                clearDraft();
                setAction('');
                setDone(false);
              }}
            >
              Discard this draft
            </button>
          </>
        )}
      </div>
    </section>
  );
}
