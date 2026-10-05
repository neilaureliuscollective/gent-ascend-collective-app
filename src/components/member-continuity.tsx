import Link from 'next/link';
import { dayLabel } from '@/domains/daily/model';
import type { Continuity } from '@/domains/continuity/model';
import './member-continuity.css';
export function MemberContinuity({
  data,
  compact = false,
}: {
  data: Continuity;
  compact?: boolean;
}) {
  return (
    <section
      className="member-continuity"
      aria-labelledby={compact ? 'continuity-heading' : 'week-heading'}
    >
      <p className="eyebrow">{compact ? 'Pick up where you left off' : 'Your last seven days'}</p>
      <h2 id={compact ? 'continuity-heading' : 'week-heading'}>
        {compact ? 'Keep your momentum.' : 'Evidence. Then your next move.'}
      </h2>
      <nav className="continuity-paths" aria-label="Continue saved work">
        {data.activeSession ? (
          <Link prefetch={false} href={data.activeSession.href}>
            <span>Training · active session</span>
            <strong>{data.activeSession.title}</strong>
            <small>Resume your saved session ↗</small>
          </Link>
        ) : (
          <Link prefetch={false} href="/app/performance">
            <span>Training</span>
            <strong>Make room for strength.</strong>
            <small>Open your program ↗</small>
          </Link>
        )}
        {!compact && (
          <Link prefetch={false} href="/app/presence">
            <span>Presence</span>
            <strong>Your appearance direction & private history.</strong>
            <small>Review when it matters ↗</small>
          </Link>
        )}
        {data.conversation ? (
          <Link prefetch={false} href={`/app/aethelios?conversation=${data.conversation.id}`}>
            <span>Aethelios & Council</span>
            <strong>{data.conversation.title}</strong>
            <small>Return to your saved conversation ↗</small>
          </Link>
        ) : (
          <Link prefetch={false} href="/app/aethelios">
            <span>Aethelios & Council</span>
            <strong>Bring what matters.</strong>
            <small>Open your conversation space ↗</small>
          </Link>
        )}
      </nav>
      {compact ? (
        <Link className="text-link" prefetch={false} href="/app/progress">
          Review the week’s actual progress ↗
        </Link>
      ) : (
        <>
          <p>
            {dayLabel(data.start)} – {dayLabel(data.today)} · {data.timezone}. Saved observations,
            as of this visit.
          </p>
          <dl className="continuity-totals">
            <div>
              <dt>Daily actions</dt>
              <dd>
                {data.actionsCompleted} / {data.actionsPlanned}
              </dd>
            </div>
            <div>
              <dt>Completed training sessions</dt>
              <dd>{data.sessionsCompleted ?? 'Unavailable'}</dd>
            </div>
            <div>
              <dt>Confirmed daily reviews</dt>
              <dd>{data.reviewedDays} / 7</dd>
            </div>
          </dl>
          <p>
            {data.recordedDays} of 7 days have a daily record. Missing entries don’t mean missed
            effort. Appearance notes are optional and remain in Presence.
          </p>
          {data.unavailable.length > 0 && (
            <p role="status">
              {data.unavailable.join(', ')} records are unavailable or incomplete. Reopen this page
              to refresh.
            </p>
          )}
          <details>
            <summary>See the recorded days</summary>
            <div className="continuity-table">
              <table>
                <caption>Seven-day saved activity</caption>
                <thead>
                  <tr>
                    <th scope="col">Day</th>
                    <th scope="col">Actions</th>
                    <th scope="col">Training</th>
                    <th scope="col">Optional appearance records</th>
                  </tr>
                </thead>
                <tbody>
                  {data.week.map((day) => (
                    <tr key={day.day}>
                      <th scope="row">{dayLabel(day.day, true)}</th>
                      <td>{day.recorded ? `${day.completed}/${day.actions}` : 'No record'}</td>
                      <td>{day.sessions ?? 'Unknown'}</td>
                      <td>{day.rituals ?? 'Unknown'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <div className="continuity-review">
            <h3>Choose one adjustment.</h3>
            <p>
              Review what worked, what got in the way, and one realistic change. Aethelios opens an
              editable draft; turn on personal context to share these saved records. Nothing is sent
              or changed when you open it.
            </p>
            <Link className="button" prefetch={false} href="/app/aethelios?starter=weekly-review">
              Review with Aethelios
            </Link>
            <Link className="text-link" prefetch={false} href="/app/welcome">
              Edit your priority and next move ↗
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
