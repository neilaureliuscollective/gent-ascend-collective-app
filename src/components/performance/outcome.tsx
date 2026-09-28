import type { DecisionOutcome } from '@/domains/performance/outcomes';
import type { ProgressionDecision } from '@/domains/performance/progression';

export function OutcomeCard({
  outcome,
  decision,
}: {
  outcome: DecisionOutcome;
  decision: ProgressionDecision;
}) {
  const proposal = decision.review.proposal;
  return (
    <div className="perf-outcome" data-state={outcome.state}>
      <p className="eyebrow">AFTER YOUR CHANGE</p>
      <h4>{outcome.title}</h4>
      <p className="perf-outcome-change">
        {decision.review.title} · {proposal?.exercise}
        <br />
        <strong>
          {proposal?.from} → {proposal?.to} reps
        </strong>
        <span>
          {' '}
          · {proposal?.sets} sets at {proposal?.load} {proposal?.unit}
        </span>
      </p>
      <p>{outcome.summary}</p>
      {outcome.attempts.length > 0 && (
        <details>
          <summary>See what you recorded ({outcome.attempts.length}/2 attempts)</summary>
          <ol className="perf-outcome-attempts">
            {outcome.attempts.map((attempt, index) => (
              <li key={attempt.sessionId}>
                <p className="eyebrow">
                  ATTEMPT {index + 1} · <time dateTime={attempt.day}>{attempt.day}</time>
                </p>
                <strong>{attempt.label}</strong>
                <p>{attempt.detail}</p>
                <dl>
                  <div>
                    <dt>Sets recorded</dt>
                    <dd>
                      {attempt.completedSets} / {attempt.targetSets}
                    </dd>
                  </div>
                  <div>
                    <dt>Reps by completed set</dt>
                    <dd>
                      {attempt.reps.length
                        ? attempt.reps.map((r) => r ?? '—').join(' · ')
                        : 'Not recorded'}
                    </dd>
                  </div>
                  <div>
                    <dt>Load by completed set</dt>
                    <dd>
                      {attempt.loads.length
                        ? `${attempt.loads.map((l) => l ?? '—').join(' · ')} ${attempt.unit}`
                        : 'Not recorded'}
                    </dd>
                  </div>
                  <div>
                    <dt>Highest reported effort</dt>
                    <dd>
                      {attempt.maxEffort === null ? 'Not recorded' : `${attempt.maxEffort}/10`}
                      {attempt.maxEffort !== null && !attempt.effortComplete
                        ? ' · partial record'
                        : ''}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ol>
        </details>
      )}
      {outcome.revisedAt && (
        <p className="perf-caption">
          This session was revised again. These results describe the earlier approved target.
        </p>
      )}
      <p className="perf-caption">
        First two synced attempts before this session is revised again. Unfinished and adapted
        workouts stay visible.
      </p>
    </div>
  );
}
