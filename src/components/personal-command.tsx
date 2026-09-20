import Link from 'next/link';
import type { GoalRow, PersonRow } from '@/platform/supabase/database';
import { domainLabels, formatCalendarDate } from '@/domains/goals/validation';
export function PersonalCommand({
  person,
  goal,
}: {
  person: Pick<PersonRow, 'display_name' | 'priority'>;
  goal: GoalRow | null;
}) {
  return (
    <>
      <div className="page-heading compact-heading">
        <div>
          <p className="eyebrow">Your command</p>
          <h1>
            {person.display_name},<br />
            <em>make today count.</em>
          </h1>
        </div>
        <Link className="text-link" href="/you">
          Your foundation →
        </Link>
      </div>
      <div className="command-grid">
        <section className="focus-panel">
          <div className="panel-heading">
            <span className="eyebrow">
              {goal ? domainLabels[goal.domain] : 'Your next chapter'}
            </span>
            <span className="pill">{goal ? 'Active focus' : 'Your direction'}</span>
          </div>
          <h2>{goal?.title ?? 'Choose a goal that matters.'}</h2>
          <p>
            {goal?.reason ||
              'Give your effort a clear direction. Begin with one goal and a concrete next step.'}
          </p>
          {goal?.target_date && (
            <p className="target-date">Target · {formatCalendarDate(goal.target_date)}</p>
          )}
          <Link className="button" href="/goals">
            {goal ? 'Review your goal' : 'Set your first goal'} <span aria-hidden="true">↗</span>
          </Link>
          <div className="focus-foot">
            <span>YOUR DIRECTION</span>
            <span>YOUR PACE</span>
          </div>
        </section>
        <section className="panel intention-panel">
          <span className="eyebrow">Your next step</span>
          <h2>{goal?.next_step ?? 'Turn intention into action.'}</h2>
          <p>
            {goal
              ? 'A step you chose. Adjust it as your circumstances change.'
              : 'Choose your goal, then name the next action you can take.'}
          </p>
          <Link className="text-link" href="/goals">
            {goal ? 'Refine your next step' : 'Find your direction'} →
          </Link>
        </section>
      </div>
      <section className="panel current-priority">
        <span className="eyebrow">What matters now</span>
        <p>{person.priority || 'You haven’t set a current priority yet.'}</p>
        <Link className="text-link" href="/you">
          {person.priority ? 'Refine your priority' : 'Add your priority'} →
        </Link>
      </section>
    </>
  );
}
