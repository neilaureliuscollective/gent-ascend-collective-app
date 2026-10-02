'use client';
import Link from 'next/link';
import { useState } from 'react';
const directions = {
  body: {
    label: 'My body',
    action: 'Choose the time for your next training session.',
    href: '/experience/performance',
    destination: 'Explore Performance',
  },
  focus: {
    label: 'My focus',
    action: 'Choose one important task. Give it twenty uninterrupted minutes.',
    href: '/app/ascend',
    destination: 'Explore your direction',
  },
  presence: {
    label: 'My presence',
    action: 'Choose one grooming ritual you can repeat tomorrow.',
    href: '/app/grooming',
    destination: 'Explore Grooming',
  },
} as const;
export function GuestDirection() {
  const [choice, setChoice] = useState<keyof typeof directions>('body');
  const [action, setAction] = useState('');
  const [done, setDone] = useState(false);
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
            {Object.entries(directions).map(([key, value]) => (
              <label key={key}>
                <input
                  type="radio"
                  name="focus"
                  value={key}
                  checked={choice === key}
                  onChange={() => {
                    setChoice(key as keyof typeof directions);
                    setDone(false);
                  }}
                />
                <span>{value.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <p>{directions[choice].action}</p>
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
        <button className="gw-action" disabled={!action.trim()} onClick={() => setDone(true)}>
          Set my direction →
        </button>
        <div role="status">
          {done && <p className="gw-confirmation">Your direction: {action}</p>}
        </div>
        <p className="gw-muted">
          This exercise stays in this page session. It is guided reflection, not an AI response.
        </p>
        {done && (
          <>
            <Link href={directions[choice].href}>{directions[choice].destination} ↗</Link>
            <p className="gw-muted">
              <Link href="/enter">Member sign in</Link> to use your saved workspace. Account access
              is currently by invitation; this draft is not transferred automatically.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
