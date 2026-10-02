'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Training } from '@/components/performance/training';
import { defaultProfile, starterPlan, startSession } from '@/domains/performance/model';
import type { Plan, Session } from '@/domains/performance/schema';
/** Explicit demonstration using the real recording component. No identity or persistence. */
export function GuestPractice() {
  const [draft, setDraft] = useState<{ plan: Plan; session: Session } | null>(null);
  return (
    <div className="gw-guest-practice">
      <h1 tabIndex={-1}>Try the practice.</h1>
      <p className="gw-muted">
        An interactive sample of workout recording. Fictional exercises and targets show how the
        tool works; they are not a personal training recommendation. Entries remain in this page
        only.
      </p>
      {!draft ? (
        <button
          className="gw-action"
          onClick={() => {
            const plan = starterPlan(defaultProfile);
            setDraft({ plan, session: startSession(plan, 0, 'lb') });
          }}
        >
          Try recording a set →
        </button>
      ) : (
        <Training
          session={draft.session}
          plan={draft.plan}
          busy={false}
          save={async (session) => {
            setDraft({ ...draft, session });
            return true;
          }}
        />
      )}
      {draft?.session.status === 'complete' && (
        <p role="status" className="gw-confirmation">
          Sample complete. Recorded sets: {draft.session.sets.filter((s) => s.done).length} sets.
          This sample has not been saved to an account.
        </p>
      )}
      <p className="gw-muted">
        <Link href="/enter">Member sign in ↗</Link> to record your own training. Or create a free account from the World to keep your own direction. Sample sets are never imported as training history.
      </p>
    </div>
  );
}
