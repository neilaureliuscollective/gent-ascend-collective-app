'use client';
import { OutcomeCard } from './outcome';
import type { Mutation, PerformanceData } from '@/domains/performance/schema';
export function ProgressionReview({
  data,
  busy,
  deviceActive,
  onAccept,
}: {
  data: PerformanceData;
  busy: boolean;
  deviceActive: boolean;
  onAccept: (input: Extract<Mutation, { kind: 'progress' }>) => void;
}) {
  return (
    <section className="perf-progression" aria-label="Session progression">
      <p className="eyebrow">YOUR NEXT STEP / ONE SESSION AT A TIME</p>
      <h3>Earn the next rep.</h3>
      <p>
        Compare each session with its own history. These rules suggest a small trial; they do not
        predict your body’s response.
      </p>
      {!data.progression?.length && (
        <p>Session evidence will appear after your program is saved and loaded online.</p>
      )}
      {data.progression?.map((review) => {
        const p = review.proposal;
        return (
          <article className="perf-progression-item" key={review.slotId}>
            <div className="perf-progression-heading">
              <h4>{review.title}</h4>
              <span className="eyebrow">
                {review.status === 'ready' ? 'PROPOSAL TO REVIEW' : 'HOLD TARGETS'}
              </span>
            </div>
            {p && (
              <p className="perf-progression-target">
                {p.exercise}{' '}
                <strong>
                  {p.from} → {p.to} reps
                </strong>
                <span>
                  {p.sets} sets · {p.load} {p.unit} stays the same
                </span>
              </p>
            )}
            <p>{review.reason}</p>
            {review.evidence.length > 0 && (
              <details>
                <summary>See the two latest records ({review.evidence.length}/2)</summary>
                <ul>
                  {review.evidence.map((e) => (
                    <li key={e.sessionId}>
                      <time dateTime={e.day}>{e.day}</time> · {e.completedSets}/{e.plannedSets} sets
                      recorded ·{' '}
                      {e.mode === 'planned'
                        ? 'As planned'
                        : e.mode === 'lighter'
                          ? 'Fewer sets'
                          : 'Shorter session'}
                    </li>
                  ))}
                </ul>
                <p className="perf-caption">
                  Self-reported work and effort. Shortened sessions still count as training; they do
                  not support this progression rule.
                </p>
              </details>
            )}
            {p && (
              <>
                <button
                  className="perf-primary"
                  disabled={busy || deviceActive}
                  onClick={() =>
                    onAccept({
                      kind: 'progress',
                      requestId: crypto.randomUUID(),
                      expectedVersion: p.programVersion,
                      slotId: review.slotId,
                      token: p.token,
                    })
                  }
                >
                  Approve {p.exercise}: {p.from} → {p.to} reps
                </button>
                <p className="perf-caption">
                  {deviceActive
                    ? 'Finish and sync the workout on this device before approving a change.'
                    : 'Only this exercise’s rep target changes. Evidence is checked again when you approve.'}
                </p>
              </>
            )}
          </article>
        );
      })}
      {data.outcomes?.[0] && data.progressionDecisions?.[0] && (
        <section className="perf-follow-through" aria-label="Latest change outcome">
          <h3>Did the change hold?</h3>
          <OutcomeCard outcome={data.outcomes[0]} decision={data.progressionDecisions[0]} />
        </section>
      )}
      {!!data.progressionDecisions?.length && (
        <details className="perf-history">
          <summary>Approved changes ({data.progressionDecisions.length})</summary>
          <p className="perf-caption">
            Your latest 20 approved changes. Outcomes describe each change’s first two attempts.
          </p>
          <ol>
            {data.progressionDecisions.map((d) => (
              <li key={d.toVersion}>
                <strong>
                  {d.review.title} · {d.review.proposal?.exercise}: {d.review.proposal?.from} →{' '}
                  {d.review.proposal?.to} reps
                </strong>
                <p className="perf-caption">
                  {new Date(d.createdAt).toLocaleDateString('en-US', { timeZone: data.timezone })} ·
                  Program v{d.fromVersion} → v{d.toVersion} · Rule v1
                </p>
                <p>{d.review.reason}</p>
                {data.outcomes?.find((o) => o.toVersion === d.toVersion) && (
                  <OutcomeCard
                    outcome={data.outcomes.find((o) => o.toVersion === d.toVersion)!}
                    decision={d}
                  />
                )}
                <p className="perf-caption">
                  Source workouts: {d.review.evidence.map((e) => e.day).join(' & ')}. This is a
                  saved decision, not a current recommendation.
                </p>
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
