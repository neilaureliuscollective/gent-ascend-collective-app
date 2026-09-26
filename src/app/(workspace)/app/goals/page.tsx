import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { currentPerson } from '@/domains/person/current';
import { readGoals } from '@/domains/goals/service';
import { domainLabels, formatCalendarDate } from '@/domains/goals/validation';
import { GoalEditor, GoalLifecycle } from '@/components/goal-editor';
import { saveGoalAction, transitionGoalAction } from './actions';
export default async function Goals() {
  const [person, goals] = await Promise.all([currentPerson(), readGoals()]);
  if (!person || !goals)
    return (
      <>
        <p className="eyebrow">Your direction</p>
        <h1>
          Make it
          <br />
          <em>meaningful.</em>
        </h1>
        <section className="panel empty-state">
          <h2>A goal worth working toward.</h2>
          <p>
            Sign in to create your personal goal, choose your next step and keep a record of your
            progress.
          </p>
          <Link className="button" href="/app/you">
            Go to your account
          </Link>
        </section>
      </>
    );
  const active = goals.find((goal) => goal.status === 'active') ?? null;
  const past = goals.filter((goal) => goal.status !== 'active');
  return (
    <>
      <div className="page-heading compact-heading">
        <div>
          <p className="eyebrow">Your direction</p>
          <h1>{active ? 'Keep moving.' : 'Choose your focus.'}</h1>
        </div>
        <Link className="text-link" href="/app">
          Back to Command →
        </Link>
      </div>
      <div className="personal-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>{active ? 'Your active goal' : 'One meaningful goal'}</h2>
            <span className="pill">{active ? 'Active focus' : 'Start here'}</span>
          </div>
          <p className="form-intro">
            {active
              ? 'Refine the direction. Keep the next step clear.'
              : 'Start with one outcome you want to move toward. You can refine it as you go.'}
          </p>
          <GoalEditor
            key={active?.id ?? 'new'}
            goal={active}
            createId={active?.id ?? randomUUID()}
            action={saveGoalAction}
          />
          {active && <GoalLifecycle goal={active} action={transitionGoalAction} />}
        </section>
        <aside className="panel perspective-panel">
          <span className="eyebrow">Your reason to begin</span>
          <h2>
            Progress starts
            <br />
            with direction.
          </h2>
          <p>
            {person.priority ||
              'Choose something that matters to your life right now. Give it a next step small enough to act on.'}
          </p>
          <Link className="text-link" href="/app/you">
            Refine your priorities →
          </Link>
          <div className="privacy-note">Your goals are private to your account.</div>
        </aside>
      </div>
      <section className="goal-history">
        <div className="section-heading">
          <h2>Previous chapters</h2>
          <span className="quiet-label">Most recent first</span>
        </div>
        {past.length ? (
          <ul className="history-list">
            {past.map((goal) => (
              <li className="panel" key={goal.id}>
                <div>
                  <span className="eyebrow">{domainLabels[goal.domain]}</span>
                  <h3>{goal.title}</h3>
                  {goal.reason && <p>{goal.reason}</p>}
                  <p className="muted">
                    {goal.closed_at
                      ? new Intl.DateTimeFormat('en-US', {
                          dateStyle: 'medium',
                          timeZone: person.timezone,
                        }).format(new Date(goal.closed_at))
                      : ''}
                    {goal.target_date ? ` · Target ${formatCalendarDate(goal.target_date)}` : ''}
                  </p>
                </div>
                <span className="pill">
                  {goal.status === 'completed' ? 'Completed' : 'Archived'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>Your completed and archived goals will remain here.</p>
        )}
      </section>
    </>
  );
}
