import Link from 'next/link';
import { PersonalCommand } from '@/components/personal-command';
import { readGoals } from '@/domains/goals/service';
import { currentPerson } from '@/domains/person/current';
export default async function Command() {
  const person = await currentPerson();
  if (person) {
    const goals = await readGoals();
    return (
      <PersonalCommand
        person={person}
        goal={goals?.find((goal) => goal.status === 'active') ?? null}
      />
    );
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Your command</p>
          <h1>
            A life built
            <br />
            <em>with intention.</em>
          </h1>
        </div>
        <p className="chapter">
          01 <span>/ YOUR WORLD</span>
        </p>
      </div>
      <div className="command-grid">
        <section className="focus-panel">
          <div className="panel-heading">
            <span className="eyebrow">Today’s perspective</span>
            <span className="pill">Foundation</span>
          </div>
          <h2>Your next chapter starts here.</h2>
          <p>
            A clearer view of what matters.
            <br />A deliberate next step.
          </p>
          <Link className="button" href="/you">
            Explore your workspace
            <span aria-hidden="true">↗</span>
          </Link>
          <div className="focus-foot">
            <span>PERSONAL GROWTH</span>
            <span>LONG-TERM VISION</span>
          </div>
        </section>
        <section className="panel intention-panel">
          <span className="eyebrow">Your direction</span>
          <h2>
            Make room
            <br />
            for what matters.
          </h2>
          <p>Your goals and daily priorities will live here. Start with your personal profile.</p>
          <Link className="text-link" href="/you">
            Your profile <span aria-hidden="true">→</span>
          </Link>
        </section>
      </div>
      <div className="section-heading">
        <h2>A connected perspective</h2>
        <Link href="/world">Explore your world →</Link>
      </div>
      <div className="domains-grid">
        {[
          ['01', 'Body & performance', 'Strength, recovery and the way you feel.'],
          ['02', 'Mind & direction', 'Clarity, routines and meaningful progress.'],
          ['03', 'Life & legacy', 'The people, work and memories that matter.'],
        ].map(([n, title, copy]) => (
          <article className="domain-card" key={n}>
            <span className="eyebrow">{n}</span>
            <h3>{title}</h3>
            <p>{copy}</p>
            <span className="quiet-label">Taking shape</span>
          </article>
        ))}
      </div>
      <div className="quiet-note">
        <span className="gold-rule" />
        <p>
          Foundation preview. Your personal records and AI insights will appear as those
          capabilities are added.
        </p>
      </div>
    </>
  );
}
