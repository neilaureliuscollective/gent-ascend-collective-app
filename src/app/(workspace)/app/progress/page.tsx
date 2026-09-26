import Link from 'next/link';
import { readDaily } from '@/domains/daily/service';
import { dayLabel } from '@/domains/daily/model';
export default async function Progress() {
  const daily = await readDaily();
  const meaningful = daily.entries.filter((entry) => entry.actions.some((action) => action.done) || entry.reflection || entry.review);
  return (
    <>
      <p className="eyebrow">The long view</p>
      <h1>
        Progress,
        <br />
        <em>over time.</em>
      </h1>
      {daily.mode === 'personal' && meaningful.length ? <div className="loop-history">{[...meaningful].reverse().map((entry) => <section className="panel" key={entry.day}>
        <span className="eyebrow">{dayLabel(entry.day)}</span>
        <h2>{entry.actions.filter((action) => action.done).length} actions completed</h2>
        {entry.actions.filter((action) => action.done).map((action) => <p key={action.id}>✓ {action.title}</p>)}
        {entry.reflection && <blockquote>{entry.reflection}</blockquote>}
        {entry.review?.progress&&<p><strong>Moved forward:</strong> {entry.review.progress}</p>}
        {entry.review?.tomorrow&&<p><strong>Carried forward:</strong> {entry.review.tomorrow}</p>}
      </section>)}</div> : <section className="panel empty-state">
        <span className="eyebrow">Your history</span>
        <h2>{daily.mode === 'preview' ? 'Sign in to see your history.' : 'Your first evidence of progress belongs here.'}</h2>
        <p>
          Complete an action or leave a reflection in Command. Your history will grow from what you actually recorded.
        </p>
        <Link className="button" href="/app#rhythm">
          View your daily observations
        </Link>
      </section>}
    </>
  );
}
